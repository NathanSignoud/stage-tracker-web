-- Étape 2 : les tables de Stage Tracker, reprises de la version locale (src/db/schema.ts).
-- À coller une fois dans Supabase → SQL Editor, puis Run.
--
-- Sécurité :
--  - chaque ligne appartient à une personne (user_id, rempli tout seul avec la personne connectée) ;
--  - sur chaque table, une règle RLS : on ne voit et ne modifie que ses propres lignes ;
--  - les liens entre tables portent aussi user_id : impossible de relier sa ligne à celle de quelqu'un d'autre ;
--  - apply_plan() applique plusieurs écritures d'un bloc (tout ou rien), avec les droits de la personne connectée.
-- Dates : mêmes formats texte que la version locale (instants en ISO UTC, dates saisies en YYYY-MM-DD,
-- date + heure d'un échange en YYYY-MM-DDTHH:mm) : la logique et les sauvegardes locales marchent telles quelles.

create function public.now_iso() returns text
language sql stable set search_path = ''
as $$ select to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

create table public.applications (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company text not null,
  title text not null default '',
  offer_url text,
  offer_text text,
  source text check (source in ('career_site', 'linkedin', 'wttj', 'jobteaser', 'job_fair', 'network', 'spontaneous', 'france_travail', 'other')),
  location text,
  remote text check (remote in ('onsite', 'hybrid', 'full')),
  duration text,
  start_date text,
  stipend text,
  deadline text,
  sent_date text,
  status text not null default 'to_explore' check (status in ('to_explore', 'to_apply', 'sent', 'followed_up', 'tech_test', 'hr_interview', 'tech_interview', 'offer', 'accepted', 'rejected', 'abandoned')),
  priority integer not null default 2 check (priority in (1, 2, 3)),
  match_score real,
  notes text,
  created_at text not null default public.now_iso(),
  updated_at text not null default public.now_iso(),
  deleted_at text,
  unique (id, user_id)
);
create index on public.applications (status);

create table public.status_changes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id bigint not null,
  from_status text,
  to_status text not null,
  changed_at text not null,
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade
);
create index on public.status_changes (application_id);

create table public.tags (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  unique (user_id, name),
  unique (id, user_id)
);

create table public.application_tags (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id bigint not null,
  tag_id bigint not null,
  primary key (application_id, tag_id),
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags (id, user_id) on delete cascade
);

create table public.contacts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  role text,
  company text,
  email text,
  phone text,
  linkedin text,
  how_we_met text,
  notes text,
  created_at text not null default public.now_iso(),
  updated_at text not null default public.now_iso(),
  deleted_at text,
  unique (id, user_id)
);

create table public.application_contacts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id bigint not null,
  contact_id bigint not null,
  relation text,
  primary key (application_id, contact_id),
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade,
  foreign key (contact_id, user_id) references public.contacts (id, user_id) on delete cascade
);

create table public.interactions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id bigint,
  contact_id bigint,
  date text not null,
  type text not null check (type in ('email_sent', 'email_received', 'call', 'interview', 'linkedin', 'meeting')),
  summary text not null,
  content text,
  location text,
  interview_kind text check (interview_kind in ('test', 'hr', 'tech', 'other')),
  duration_minutes integer,
  next_action text,
  next_action_date text,
  created_at text not null default public.now_iso(),
  updated_at text not null default public.now_iso(),
  deleted_at text,
  unique (id, user_id),
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade,
  -- Seul contact_id est vidé si le contact disparaît (user_id doit rester).
  foreign key (contact_id, user_id) references public.contacts (id, user_id) on delete set null (contact_id)
);
create index on public.interactions (application_id);

create table public.documents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('cv', 'letter', 'other')),
  label text not null,
  content text,
  file_path text,
  file_name text,
  mime_type text,
  is_base boolean not null default false,
  created_at text not null default public.now_iso(),
  deleted_at text,
  unique (id, user_id)
);

create table public.application_documents (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id bigint not null,
  document_id bigint not null,
  sent_at text,
  primary key (application_id, document_id),
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade,
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade
);

create table public.tasks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  due_date text,
  application_id bigint,
  interaction_id bigint,
  origin text not null default 'manual' check (origin in ('manual', 'auto_followup', 'interaction', 'thank_you')),
  done_at text,
  cancelled_at text,
  created_at text not null default public.now_iso(),
  deleted_at text,
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade,
  foreign key (interaction_id, user_id) references public.interactions (id, user_id) on delete set null (interaction_id)
);
create index on public.tasks (application_id);

create table public.keywords (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null,
  aliases jsonb not null default '[]',
  category text,
  mine boolean not null default false,
  unique (user_id, label)
);

create table public.templates (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('prompt', 'message')),
  key text not null,
  name text not null,
  subject text,
  body text not null,
  updated_at text not null default public.now_iso(),
  unique (user_id, kind, key)
);

create table public.interview_preps (
  application_id bigint primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_notes text,
  updated_at text not null default public.now_iso(),
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade
);

create table public.prep_questions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  application_id bigint not null,
  kind text not null check (kind in ('answer', 'ask')),
  question text not null,
  answer text,
  confidence integer not null default 0,
  review_count integer not null default 0,
  last_reviewed_at text,
  created_at text not null default public.now_iso(),
  deleted_at text,
  foreign key (application_id, user_id) references public.applications (id, user_id) on delete cascade
);
create index on public.prep_questions (application_id);

create table public.companies (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  careers_url text,
  location text,
  sector text,
  notes text,
  status text not null default 'to_explore' check (status in ('to_explore', 'interesting', 'dismissed')),
  created_at text not null default public.now_iso(),
  updated_at text not null default public.now_iso(),
  deleted_at text
);

create table public.settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  primary key (user_id, key)
);

-- La même règle pour toutes les tables (une boucle : aucune table ne peut être oubliée).
-- Ce projet n'accorde aucun droit par défaut aux nouvelles tables : le grant est explicite.
do $$
declare
  t text;
begin
  foreach t in array array[
    'applications', 'status_changes', 'tags', 'application_tags', 'contacts', 'application_contacts',
    'interactions', 'documents', 'application_documents', 'tasks', 'keywords', 'templates',
    'interview_preps', 'prep_questions', 'companies', 'settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "propriétaire seulement" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create index on public.%I (user_id)', t);
  end loop;
end;
$$;

-- Applique une liste d'écritures d'un bloc : si une seule échoue, aucune n'est gardée.
-- Opération : {"table": "...", "op": "insert" | "update" | "delete", "values": {...}, "match": {"colonne": valeur ou [valeurs]}}.
-- Dans "values", {"$ref": n} est remplacé par l'id inséré par l'opération n (comptée à partir de 0).
-- Renvoie les id insérés, à la position de chaque opération (null pour update / delete).
-- security invoker : tourne avec les droits de la personne connectée, donc les règles RLS s'appliquent.
create function public.apply_plan(ops jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allowed constant text[] := array[
    'applications', 'status_changes', 'tags', 'application_tags', 'contacts', 'application_contacts',
    'interactions', 'documents', 'application_documents', 'tasks', 'keywords', 'templates',
    'interview_preps', 'prep_questions', 'companies', 'settings'
  ];
  op jsonb;
  tbl text;
  vals jsonb;
  cols text;
  cond text;
  inserted jsonb;
  ids jsonb := '[]';
begin
  for op in select value from jsonb_array_elements(ops) loop
    tbl := op ->> 'table';
    if tbl is null or not tbl = any (allowed) then
      raise exception 'apply_plan : table non autorisée (%)', tbl;
    end if;

    select coalesce(jsonb_object_agg(key, case
             when jsonb_typeof(value) = 'object' and value ? '$ref' then ids -> (value ->> '$ref')::int
             else value end), '{}')
      into vals from jsonb_each(coalesce(op -> 'values', '{}'));
    select string_agg(format('%I', key), ', ') into cols from jsonb_object_keys(vals) as key;
    -- colonne = valeur, ou colonne parmi [valeurs] ; les valeurs sont passées en paramètre, jamais collées dans le SQL.
    select string_agg(format(
             '(case jsonb_typeof($2 -> %1$L) when ''array'' then $2 -> %1$L else jsonb_build_array($2 -> %1$L) end) @> to_jsonb(t.%1$I)',
             key), ' and ')
      into cond from jsonb_object_keys(coalesce(op -> 'match', '{}')) as key;

    case op ->> 'op'
      when 'insert' then
        if cols is null then raise exception 'apply_plan : insert sans valeurs (%)', tbl; end if;
        execute format(
          'insert into public.%1$I as t (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) returning to_jsonb(t) -> ''id''',
          tbl, cols)
          into inserted using vals, op -> 'match';
        ids := ids || jsonb_build_array(inserted);
      when 'update' then
        if cols is null or cond is null then raise exception 'apply_plan : update sans valeurs ou sans condition (%)', tbl; end if;
        execute format(
          'update public.%1$I as t set (%2$s) = (select %2$s from jsonb_populate_record(null::public.%1$I, $1)) where %3$s',
          tbl, cols, cond)
          using vals, op -> 'match';
        ids := ids || '[null]';
      when 'delete' then
        if cond is null then raise exception 'apply_plan : delete sans condition (%)', tbl; end if;
        execute format('delete from public.%1$I as t where %2$s', tbl, cond) using vals, op -> 'match';
        ids := ids || '[null]';
      else
        raise exception 'apply_plan : opération inconnue (%)', op ->> 'op';
    end case;
  end loop;
  return ids;
end;
$$;

revoke execute on function public.apply_plan(jsonb) from public, anon;
grant execute on function public.apply_plan(jsonb) to authenticated;
