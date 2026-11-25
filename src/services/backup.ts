import { rawRows, type Table } from "@/lib/db";

const TABLES: Table[] = [
  "applications", "status_changes", "tags", "application_tags", "contacts", "application_contacts", "interactions",
  "documents", "application_documents", "tasks", "keywords", "templates", "interview_preps", "prep_questions", "companies", "settings",
];

/** Toutes les données de la personne connectée (mêmes clés que la sauvegarde de la version locale). */
export async function exportMyData(now = new Date()) {
  const tables = Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await rawRows(t)] as const)));
  return { format: "stage-tracker-backup", version: 1, exportedAt: now.toISOString(), source: "web", tables };
}
