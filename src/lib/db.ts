import { supabase } from "@/lib/supabase";

// Accès aux tables : en base les colonnes sont en snake_case, dans le code en camelCase (comme la version locale).
// Tout passe par `backend` (Supabase sur le site, un Postgres en mémoire dans les tests : tests/helpers.ts).

export type Table =
  | "applications"
  | "status_changes"
  | "tags"
  | "application_tags"
  | "contacts"
  | "application_contacts"
  | "interactions"
  | "documents"
  | "application_documents"
  | "tasks"
  | "keywords"
  | "templates"
  | "interview_preps"
  | "prep_questions"
  | "companies"
  | "settings";

type Values = Record<string, unknown>;
type Scalar = string | number | boolean;
/** Filtre de lecture : colonne = valeur, colonne IS NULL (null), colonne parmi [valeurs]. Clés en camelCase. */
export type Where = Record<string, Scalar | null | Scalar[]>;

/** Une écriture d'un plan (clés en camelCase). `match` : colonne = valeur, ou colonne parmi [valeurs]. */
export type PlanOp =
  | { table: Table; op: "insert"; values: Values }
  | { table: Table; op: "update"; values: Values; match: Values }
  | { table: Table; op: "delete"; match: Values };

/** Dans `values` : l'id créé par l'opération n du même plan (comptée à partir de 0). */
export const ref = (n: number) => ({ $ref: n });

const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
// Clés de premier niveau seulement : le contenu des colonnes JSON (réglages, alias) reste tel quel.
const mapKeys = <T extends Values>(obj: T, f: (key: string) => string) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [f(k), v])) as T;

/** Ligne lue en base → objet du code. */
export const fromRow = <T>(row: Values): T => mapKeys(row, toCamel) as T;

/** Plan → paramètre de la fonction SQL apply_plan (supabase/migrations/20261125000000_schema.sql). */
export function toPlanPayload(ops: PlanOp[]) {
  return ops.map((o) => ({
    table: o.table,
    op: o.op,
    ...("values" in o && { values: mapKeys(o.values, toSnake) }),
    ...("match" in o && { match: mapKeys(o.match, toSnake) }),
  }));
}

/** Ce que les services demandent à la base (clés déjà en snake_case). */
export type DbBackend = {
  select(table: Table, where: Where): Promise<Values[]>;
  applyPlan(payload: ReturnType<typeof toPlanPayload>): Promise<(number | null)[]>;
  /** Insère ou met à jour selon la contrainte unique `conflict` ; `ignore` : garde les lignes existantes. */
  upsert(table: Table, rows: Values[], conflict: string, ignore: boolean): Promise<void>;
};

const PAGE = 1000; // Supabase renvoie au plus 1000 lignes par requête : on lit page par page.
// Ordre stable pour la pagination (tables sans colonne id).
const ORDER: Partial<Record<Table, string[]>> = {
  application_tags: ["application_id", "tag_id"],
  application_contacts: ["application_id", "contact_id"],
  application_documents: ["application_id", "document_id"],
  interview_preps: ["application_id"],
  settings: ["key"],
};
export const orderColumns = (table: Table): string[] => ORDER[table] ?? ["id"];

const supabaseBackend: DbBackend = {
  async select(table, where) {
    const out: Values[] = [];
    for (let from = 0; ; from += PAGE) {
      let query = supabase.from(table).select("*");
      for (const [column, value] of Object.entries(where)) {
        query = value === null ? query.is(column, null) : Array.isArray(value) ? query.in(column, value) : query.eq(column, value);
      }
      for (const column of orderColumns(table)) query = query.order(column);
      const { data, error } = await query.range(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...data);
      if (data.length < PAGE) return out;
    }
  },
  async applyPlan(payload) {
    const { data, error } = await supabase.rpc("apply_plan", { ops: payload });
    if (error) throw error;
    return data as (number | null)[];
  },
  async upsert(table, rows, conflict, ignore) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict, ignoreDuplicates: ignore });
    if (error) throw error;
  },
};

let backend = supabaseBackend;
/** Tests uniquement : remplace Supabase par une autre base. */
export const setBackend = (b: DbBackend) => {
  backend = b;
};

/** Lignes de la personne connectée (les règles RLS filtrent le reste). */
export async function rows<T>(table: Table, where: Where = {}): Promise<T[]> {
  return (await backend.select(table, mapKeys(where, toSnake))).map((r) => fromRow<T>(r));
}

/** Lignes brutes (colonnes de la base), pour l'export « mes données ». */
export function rawRows(table: Table): Promise<Values[]> {
  return backend.select(table, {});
}

/** Une ligne, ou null. */
export async function row<T>(table: Table, where: Where): Promise<T | null> {
  return (await rows<T>(table, where))[0] ?? null;
}

/** Applique les écritures d'un bloc (tout ou rien). Renvoie l'id inséré par chaque opération (null sinon). */
export function applyPlan(ops: PlanOp[]): Promise<(number | null)[]> {
  return ops.length ? backend.applyPlan(toPlanPayload(ops)) : Promise.resolve([]);
}

/** Insertion ou mise à jour en une requête. `conflict` : colonnes d'une contrainte unique de la table, en camelCase. */
export function upsert(table: Table, values: Values[], conflict: string[], { ignore = false } = {}): Promise<void> {
  if (!values.length) return Promise.resolve();
  return backend.upsert(table, values.map((v) => mapKeys(v, toSnake)), conflict.map(toSnake).join(","), ignore);
}

export const insert = (table: Table, values: Values): PlanOp => ({ table, op: "insert", values });
export const update = (table: Table, match: Values, values: Values): PlanOp => ({ table, op: "update", values, match });
export const remove = (table: Table, match: Values): PlanOp => ({ table, op: "delete", match });

/** Tri comme les ORDER BY de la version locale (SQLite) : null d'abord, puis ordre binaire. */
export function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  return (a as string) < (b as string) ? -1 : 1;
}
