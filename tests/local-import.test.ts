import { describe, expect, it } from "vitest";
import { importSql, type LocalBackup } from "../scripts/local-import";
import { migratedDb } from "./helpers";

// Import unique des données de la version locale : le script SQL généré est exécuté sur un vrai Postgres (PGlite),
// au nom de l'administrateur, avec les règles RLS. Fausse sauvegarde au format de la version locale (lignes SQLite).

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const OTHER = "00000000-0000-4000-8000-0000000000ee";

const backup: LocalBackup = {
  format: "stage-tracker-backup",
  version: 1,
  tables: {
    applications: [
      { id: 4, company: "Mistral AI", title: "Stage LLM", status: "sent", priority: 1, sent_date: "2026-11-02", match_score: 0.5, created_at: "2026-11-01T10:00:00.000Z", updated_at: "2026-11-02T10:00:00.000Z", deleted_at: null },
      { id: 9, company: "Owkin", title: "", status: "to_explore", priority: 2, created_at: "2026-11-03T10:00:00.000Z", updated_at: "2026-11-03T10:00:00.000Z", deleted_at: "2026-11-04T10:00:00.000Z" },
    ],
    status_changes: [
      { id: 1, application_id: 4, from_status: null, to_status: "to_explore", changed_at: "2026-11-01T10:00:00.000Z" },
      { id: 2, application_id: 4, from_status: "to_explore", to_status: "sent", changed_at: "2026-11-02T10:00:00.000Z" },
      { id: 3, application_id: 999, from_status: null, to_status: "sent", changed_at: "2026-11-02T10:00:00.000Z" },
    ],
    tags: [{ id: 2, name: "NLP" }],
    application_tags: [{ application_id: 4, tag_id: 2 }],
    contacts: [{ id: 5, name: "Camille", company: "Mistral AI", created_at: "2026-11-01T10:00:00.000Z", updated_at: "2026-11-01T10:00:00.000Z", deleted_at: null }],
    application_contacts: [{ application_id: 4, contact_id: 5, relation: "Recruteuse" }],
    interactions: [
      { id: 7, application_id: 4, contact_id: 5, date: "2026-11-05T10:00", type: "call", summary: "Appel RH", next_action: "Envoyer le portfolio", created_at: "2026-11-05T10:00:00.000Z", updated_at: "2026-11-05T10:00:00.000Z", deleted_at: null },
    ],
    tasks: [
      { id: 11, title: "Relancer Mistral AI", due_date: "2026-11-12", application_id: 4, interaction_id: null, origin: "auto_followup", created_at: "2026-11-02T10:00:00.000Z" },
      { id: 12, title: "Envoyer le portfolio", due_date: null, application_id: 4, interaction_id: 7, origin: "interaction", created_at: "2026-11-05T10:00:00.000Z" },
    ],
    documents: [{ id: 3, kind: "cv", label: "CV de base", content: null, file_path: "3-CV.pdf", file_name: "CV.pdf", mime_type: "application/pdf", is_base: 1, created_at: "2026-11-01T10:00:00.000Z", deleted_at: null }],
    application_documents: [{ application_id: 4, document_id: 3, sent_at: "2026-11-02" }],
    companies: [{ id: 1, name: "Hugging Face", status: "interesting", created_at: "2026-11-01T10:00:00.000Z", updated_at: "2026-11-01T10:00:00.000Z", deleted_at: null }],
    keywords: [{ id: 1, label: "Python", aliases: '["py"]', category: "Langages", mine: 1 }],
    templates: [{ id: 1, kind: "message", key: "follow_up", name: "Ma relance", subject: "Re", body: "Coucou {entreprise}", updated_at: "2026-11-01T10:00:00.000Z" }],
    prep_questions: [{ id: 1, application_id: 4, kind: "answer", question: "Présentez-vous.", answer: null, confidence: 2, review_count: 3, created_at: "2026-11-05T10:00:00.000Z", deleted_at: null }],
    interview_preps: [],
    settings: [
      { key: "profile", value: '{"fullName":"Alex Martin"}' },
      { key: "weeklyGoal", value: "8" },
      { key: "seedVersion", value: "3" },
      { key: "calendarToken", value: '"ancien-jeton-local"' },
    ],
  },
};

/** Base avec l'administrateur (invité, déjà connecté une fois : données de départ créées) et une autre personne. */
async function setup() {
  const db = await migratedDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${ADMIN}', 'admin@example.com'), ('${OTHER}', 'autre@example.com');
    insert into public.invitations (email, is_admin) values ('admin@example.com', true), ('autre@example.com', false);
    delete from public.invitations where email = 'ton.adresse@gmail.com';
    insert into public.keywords (user_id, label) values ('${ADMIN}', 'Défaut'), ('${OTHER}', 'Chez l''autre');
    insert into public.templates (user_id, kind, key, name, body) values ('${ADMIN}', 'message', 'follow_up', 'Relance', 'Texte livré'), ('${ADMIN}', 'message', 'thank_you', 'Merci', 'Texte livré');
    insert into public.settings (user_id, key, value) values ('${ADMIN}', 'weeklyGoal', '5'), ('${ADMIN}', 'seedVersion', '1'), ('${ADMIN}', 'thankYouReminder', 'true');
  `);
  return db;
}

const asAdmin = (sql: string) => `begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub": "${ADMIN}"}', true); ${sql}`;

describe("import des données de la version locale", () => {
  it("tout est importé d'un bloc, liens conservés, réglages et gabarits locaux à la place des défauts", async () => {
    const db = await setup();
    const { sql, summary } = importSql(backup, "test");
    expect(summary.skipped).toEqual(["status_changes n°3 : applications n°999 introuvable"]);
    const results = await db.exec(sql);
    expect(String(results.at(-1)?.rows[0]?.resultat)).toMatch(/^Import terminé : applications 2/);

    const q = async <T,>(query: string) => (await db.query<T>(query)).rows;
    await db.exec(asAdmin("select 1"));
    const apps = await q<{ id: number; company: string; deleted_at: string | null; user_id: string }>("select id, company, deleted_at, user_id from public.applications order by company");
    expect(apps.map((a) => [a.company, a.deleted_at !== null, a.user_id])).toEqual([
      ["Mistral AI", false, ADMIN],
      ["Owkin", true, ADMIN],
    ]);
    const mistral = apps[0].id;
    expect(await q("select to_status from public.status_changes order by changed_at")).toEqual([{ to_status: "to_explore" }, { to_status: "sent" }]);
    expect(await q(`select count(*)::int n from public.application_tags where application_id = ${mistral}`)).toEqual([{ n: 1 }]);
    expect(await q(`select relation from public.application_contacts where application_id = ${mistral}`)).toEqual([{ relation: "Recruteuse" }]);
    const [call] = await q<{ id: number; contact_id: number }>("select id, contact_id from public.interactions");
    const tasks = await q<{ title: string; application_id: number; interaction_id: number | null }>("select title, application_id, interaction_id from public.tasks order by title");
    expect(tasks).toEqual([
      { title: "Envoyer le portfolio", application_id: mistral, interaction_id: call.id },
      { title: "Relancer Mistral AI", application_id: mistral, interaction_id: null },
    ]);
    expect(await q("select file_path, file_name, is_base from public.documents")).toEqual([{ file_path: null, file_name: "CV.pdf", is_base: true }]);
    expect(await q(`select sent_at from public.application_documents where application_id = ${mistral}`)).toEqual([{ sent_at: "2026-11-02" }]);
    expect(await q("select label, aliases, mine from public.keywords")).toEqual([{ label: "Python", aliases: ["py"], mine: true }]);
    expect(await q("select key, name from public.templates order by key")).toEqual([
      { key: "follow_up", name: "Ma relance" },
      { key: "thank_you", name: "Merci" },
    ]);
    expect(await q("select key, value from public.settings order by key")).toEqual([
      { key: "profile", value: { fullName: "Alex Martin" } },
      { key: "seedVersion", value: 1 },
      { key: "thankYouReminder", value: true },
      { key: "weeklyGoal", value: 8 },
    ]);
    expect(await q("select confidence, review_count from public.prep_questions")).toEqual([{ confidence: 2, review_count: 3 }]);
    await db.exec("rollback");

    // Les données de l'autre personne n'ont pas bougé.
    expect((await db.query(`select label from public.keywords where user_id = '${OTHER}'`)).rows).toEqual([{ label: "Chez l'autre" }]);
  });

  it("refusé si le compte contient déjà des candidatures (pas de doublons), sans rien écrire", async () => {
    const db = await setup();
    await db.exec(`insert into public.applications (user_id, company) values ('${ADMIN}', 'Déjà là')`);
    await expect(db.exec(importSql(backup, "test").sql)).rejects.toThrow(/contient déjà des candidatures/);
    await db.exec("rollback");
    expect((await db.query("select count(*)::int n from public.keywords")).rows).toEqual([{ n: 2 }]);
  });
});
