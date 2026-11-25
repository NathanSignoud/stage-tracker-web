// Import unique des données de la version locale (sauvegarde `stage-tracker-backup` v1, lignes SQLite brutes)
// dans le compte en ligne : un plan pour apply_plan (identifiants recalculés, liens conservés par {"$ref": n}).
// Aucun import à l'exécution : utilisable par Node (`--experimental-strip-types`) et par les tests.

type Row = Record<string, unknown>;
export type LocalBackup = { format: string; version: number; tables: Record<string, Row[]> };
export type PlanEntry = { table: string; op: "insert"; values: Row };

/** Colonnes reprises, par table (celles du schéma en ligne, sans user_id qui est rempli par la base). */
const COLUMNS: Record<string, string[]> = {
  applications: ["company", "title", "offer_url", "offer_text", "source", "location", "remote", "duration", "start_date", "stipend", "deadline", "sent_date", "status", "priority", "match_score", "notes", "created_at", "updated_at", "deleted_at"],
  contacts: ["name", "role", "company", "email", "phone", "linkedin", "how_we_met", "notes", "created_at", "updated_at", "deleted_at"],
  tags: ["name"],
  // file_path n'est pas repris : les fichiers sont à rejoindre depuis le site (bouton « Joindre le fichier »).
  documents: ["kind", "label", "content", "file_name", "mime_type", "is_base", "created_at", "deleted_at"],
  companies: ["name", "careers_url", "location", "sector", "notes", "status", "created_at", "updated_at", "deleted_at"],
  keywords: ["label", "aliases", "category", "mine"],
  templates: ["kind", "key", "name", "subject", "body", "updated_at"],
  status_changes: ["from_status", "to_status", "changed_at"],
  interactions: ["date", "type", "summary", "content", "location", "interview_kind", "duration_minutes", "next_action", "next_action_date", "created_at", "updated_at", "deleted_at"],
  tasks: ["title", "due_date", "origin", "done_at", "cancelled_at", "created_at", "deleted_at"],
  application_contacts: ["relation"],
  application_documents: ["sent_at"],
  interview_preps: ["company_notes", "updated_at"],
  prep_questions: ["kind", "question", "answer", "confidence", "review_count", "last_reviewed_at", "created_at", "deleted_at"],
};
const BOOLEANS = new Set(["is_base", "mine"]);
const JSON_TEXT = new Set(["aliases", "value"]);
/** Réglages propres à la version locale, pas repris (le lien d'agenda local n'a plus de sens en ligne). */
const SKIPPED_SETTINGS = new Set(["seedVersion", "calendarToken", "calendarTimeZone"]);

function pick(table: string, row: Row): Row {
  const out: Row = {};
  for (const column of COLUMNS[table] ?? []) {
    let value = row[column];
    if (value === undefined) continue;
    if (BOOLEANS.has(column) && typeof value === "number") value = value === 1;
    if (JSON_TEXT.has(column) && typeof value === "string") value = JSON.parse(value);
    out[column] = value;
  }
  return out;
}

export type ImportSummary = { counts: Record<string, number>; skipped: string[]; settingKeys: string[]; templateKeys: string[] };

/** Plan d'écritures + résumé. Les lignes dont le parent obligatoire est introuvable sont ignorées (et signalées). */
export function backupToPlan(backup: LocalBackup): { plan: PlanEntry[]; summary: ImportSummary } {
  if (backup.format !== "stage-tracker-backup" || backup.version !== 1) throw new Error("Ce fichier n'est pas une sauvegarde stage-tracker v1");
  const t = (name: string) => backup.tables[name] ?? [];
  const plan: PlanEntry[] = [];
  const refs: Record<string, Map<unknown, number>> = {};
  const counts: Record<string, number> = {};
  const skipped: string[] = [];

  const add = (table: string, values: Row, localId?: unknown) => {
    if (localId !== undefined) (refs[table] ??= new Map()).set(localId, plan.length);
    plan.push({ table, op: "insert", values });
    counts[table] = (counts[table] ?? 0) + 1;
  };
  const ref = (table: string, localId: unknown) => {
    const index = localId == null ? undefined : refs[table]?.get(localId);
    return index === undefined ? null : { $ref: index };
  };

  // Tables sans parent, puis celles qui y renvoient.
  for (const table of ["applications", "contacts", "tags", "documents", "companies", "keywords", "templates"]) {
    for (const row of t(table)) add(table, pick(table, row), row.id);
  }
  const settings = t("settings").filter((s) => !SKIPPED_SETTINGS.has(String(s.key)));
  for (const s of settings) add("settings", { key: s.key, value: typeof s.value === "string" ? JSON.parse(s.value) : s.value });

  const required = (table: string, row: Row, links: Record<string, string>): Row | null => {
    const values = pick(table, row);
    for (const [column, parent] of Object.entries(links)) {
      const r = ref(parent, row[column]);
      if (!r) {
        skipped.push(`${table} n°${row.id ?? "?"} : ${parent} n°${row[column]} introuvable`);
        return null;
      }
      values[column] = r;
    }
    return values;
  };

  for (const row of t("status_changes")) {
    const values = required("status_changes", row, { application_id: "applications" });
    if (values) add("status_changes", values);
  }
  for (const row of t("application_tags")) {
    const values = required("application_tags", row, { application_id: "applications", tag_id: "tags" });
    if (values) add("application_tags", values);
  }
  for (const row of t("application_contacts")) {
    const values = required("application_contacts", row, { application_id: "applications", contact_id: "contacts" });
    if (values) add("application_contacts", values);
  }
  for (const row of t("application_documents")) {
    const values = required("application_documents", row, { application_id: "applications", document_id: "documents" });
    if (values) add("application_documents", values);
  }
  for (const row of t("interview_preps")) {
    const values = required("interview_preps", row, { application_id: "applications" });
    if (values) add("interview_preps", values);
  }
  for (const row of t("prep_questions")) {
    const values = required("prep_questions", row, { application_id: "applications" });
    if (values) add("prep_questions", values);
  }
  // Liens facultatifs : un parent introuvable devient « aucun ».
  for (const row of t("interactions")) {
    add("interactions", { ...pick("interactions", row), application_id: ref("applications", row.application_id), contact_id: ref("contacts", row.contact_id) }, row.id);
  }
  for (const row of t("tasks")) {
    add("tasks", { ...pick("tasks", row), application_id: ref("applications", row.application_id), interaction_id: ref("interactions", row.interaction_id) });
  }

  return {
    plan,
    summary: { counts, skipped, settingKeys: settings.map((s) => String(s.key)), templateKeys: t("templates").map((r) => `${r.kind}/${r.key}`) },
  };
}

/** Script SQL à coller dans Supabase : tout ou rien, au nom de l'administrateur du site, avec les règles RLS. */
export function importSql(backup: LocalBackup, label: string): { sql: string; summary: ImportSummary } {
  const { plan, summary } = backupToPlan(backup);
  const payload = JSON.stringify(plan);
  let tag = "plan";
  while (payload.includes(`$${tag}$`)) tag += "_";
  const list = (values: string[]) => values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ") || "''";
  const lines = Object.entries(summary.counts).map(([k, n]) => `${k} ${n}`).join(", ");
  const sql = `-- Import unique des données de la version locale (${label}) dans ton compte en ligne.
-- À coller une seule fois dans Supabase → SQL Editor, puis Run. Tout ou rien : en cas d'erreur, rien n'est écrit.
-- Contenu : ${lines}.
-- Ce fichier contient tes données personnelles : ne le partage pas et supprime-le après l'import.
begin;

-- Le compte : celui de l'administrateur du site (toi), retrouvé par son invitation.
select set_config('request.jwt.claims', json_build_object('sub', (
  select u.id from auth.users u join public.invitations i on i.email = lower(u.email) where i.is_admin
), 'role', 'authenticated')::text, true);
do $check$ begin
  if (select count(*) from auth.users u join public.invitations i on i.email = lower(u.email) where i.is_admin) <> 1 then
    raise exception 'Import annulé : il faut exactement un compte administrateur, déjà connecté une fois au site.';
  end if;
end $check$;

-- À partir d'ici, les écritures se font au nom de ce compte, avec les mêmes règles que le site.
set local role authenticated;
do $check$ begin
  if exists (select 1 from public.applications) then
    raise exception 'Import annulé : ton compte en ligne contient déjà des candidatures (supprime-les définitivement d''abord, pour éviter les doublons).';
  end if;
end $check$;

-- Tes réglages, gabarits et mots-clés locaux remplacent ceux créés par défaut à ta première connexion.
delete from public.keywords;
delete from public.templates where kind || '/' || key in (${list(summary.templateKeys)});
delete from public.settings where key in (${list(summary.settingKeys)});

select public.apply_plan($${tag}$${payload}$${tag}$::jsonb);

commit;

select 'Import terminé : ${lines.replace(/'/g, "''")}.' as resultat;
`;
  return { sql, summary };
}
