import type { PGlite } from "@electric-sql/pglite";
import { orderColumns, type DbBackend } from "@/lib/db";

// Un vrai Postgres en mémoire (PGlite) + le minimum de Supabase dont nos migrations dépendent :
// rôles, schéma auth, auth.uid() / auth.jwt() lus dans request.jwt.claims (comme Supabase).
export const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role supabase_auth_admin nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.jwt() returns jsonb language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid default auth.uid());
  create function storage.foldername(name text) returns text[] language sql immutable
    as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
`;

const ident = (name: string) => {
  if (!/^[a-z_]+$/.test(name)) throw new Error(`Nom de colonne inattendu : ${name}`);
  return name;
};

/** Ce que fait Supabase pour le site, mais sur PGlite (mêmes règles RLS : on est connecté en tant que la personne). */
export function pgliteBackend(db: PGlite): DbBackend {
  return {
    async select(table, where, columns) {
      const params: string[] = [];
      const conditions = Object.entries(where).map(([column, value]) => {
        if (value === null) return `t.${ident(column)} is null`;
        params.push(JSON.stringify(value));
        return Array.isArray(value) ? `$${params.length}::jsonb @> to_jsonb(t.${ident(column)})` : `to_jsonb(t.${ident(column)}) = $${params.length}::jsonb`;
      });
      const filter = conditions.length ? ` where ${conditions.join(" and ")}` : "";
      const list = columns ? columns.map(ident).join(", ") : "*";
      const sql = `select ${list} from public.${ident(table)} t${filter} order by ${orderColumns(table).map(ident).join(", ")}`;
      return (await db.query<Record<string, unknown>>(sql, params)).rows;
    },
    async applyPlan(payload) {
      return (await db.query<{ ids: (number | null)[] }>("select public.apply_plan($1::jsonb) as ids", [JSON.stringify(payload)])).rows[0].ids;
    },
    async upsert(table, values, conflict, ignore) {
      const cols = [...new Set(values.flatMap(Object.keys))].map(ident);
      const list = cols.join(", ");
      const action = ignore ? "nothing" : `update set ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}`;
      await db.query(
        `insert into public.${ident(table)} (${list}) select ${list} from jsonb_populate_recordset(null::public.${ident(table)}, $1::jsonb)
         on conflict (${conflict.split(",").map(ident).join(", ")}) do ${action}`,
        [JSON.stringify(values)],
      );
    },
  };
}

