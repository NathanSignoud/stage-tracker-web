import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { fromRow, ref, toPlanPayload } from "@/lib/db";
import { migratedDb, root } from "./helpers";

it("migrations puis vérification de sécurité (supabase/tests/verification.sql)", async () => {
  const db = await migratedDb();
  const results = await db.exec(readFileSync(path.join(root, "supabase", "tests", "verification.sql"), "utf8"));
  expect(results.at(-1)?.rows[0]).toMatchObject({ resultat: expect.stringMatching(/^Tout est bon/) });
  // Le rollback final n'a rien laissé.
  expect((await db.query("select count(*)::int as n from public.applications")).rows[0]).toEqual({ n: 0 });
}, 30_000);

it("le plan écrit en camelCase par le site est compris par apply_plan", async () => {
  const db = await migratedDb();
  const user = "00000000-0000-4000-8000-0000000000aa";
  const plan = toPlanPayload([
    { table: "applications", op: "insert", values: { company: "Mistral AI", sentDate: "2026-11-20", status: "sent" } },
    { table: "status_changes", op: "insert", values: { applicationId: ref(0), fromStatus: null, toStatus: "sent", changedAt: "2026-11-20T09:00:00.000Z" } },
    { table: "tasks", op: "insert", values: { title: "Relancer Mistral AI", dueDate: "2026-11-30", applicationId: ref(0), origin: "auto_followup" } },
  ]);
  await db.exec(`insert into auth.users (id) values ('${user}')`);
  await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub": "${user}"}', true);`);
  const ids = (await db.query<{ ids: number[] }>("select public.apply_plan($1) as ids", [plan])).rows[0].ids;
  const app = (await db.query<Record<string, unknown>>("select * from public.applications")).rows[0];
  const task = (await db.query<Record<string, unknown>>("select * from public.tasks")).rows[0];
  await db.exec("rollback");

  expect(ids).toEqual([app.id, expect.any(Number), task.id]);
  expect(fromRow(app)).toMatchObject({ company: "Mistral AI", sentDate: "2026-11-20", userId: user, createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/) });
  expect(fromRow(task)).toMatchObject({ applicationId: app.id, dueDate: "2026-11-30", origin: "auto_followup", doneAt: null });
}, 30_000);
