import { describe, expect, it } from "vitest";
import { applyPlan, row, rows, update } from "@/lib/db";
import type { Application, StatusChange, Task } from "@/lib/types";
import {
  changeStatus,
  createApplication,
  getApplicationDetail,
  listApplications,
  markFollowedUp,
  updateApplication,
} from "@/services/applications";
import { updateSettings } from "@/services/settings";
import { appInput, at, testUser } from "./helpers";

// Repris de la version locale (tests/applications.test.ts), sur Postgres + règles RLS.

const tasksOf = (applicationId: number) => rows<Task>("tasks", { applicationId });
const trash = (id: number) => applyPlan([update("applications", { id }, { deletedAt: "2026-10-02T00:00:00.000Z" })]);

describe("changements de statut", () => {
  it("historise chaque changement, y compris la création", async () => {
    await testUser();
    const id = await createApplication(appInput(), at("2026-10-01"));
    await changeStatus(id, "to_apply", at("2026-10-02"));
    await changeStatus(id, "to_apply", at("2026-10-03")); // sans effet
    await changeStatus(id, "hr_interview", at("2026-10-04"));

    const history = await rows<StatusChange>("status_changes", { applicationId: id });
    expect(history.map((h) => [h.fromStatus, h.toStatus])).toEqual([
      [null, "to_explore"],
      ["to_explore", "to_apply"],
      ["to_apply", "hr_interview"],
    ]);
    expect(history[2].changedAt).toBe(at("2026-10-04").toISOString());
  });

  it("Envoyée → crée une relance à J+10 et renseigne la date d'envoi", async () => {
    await testUser();
    const id = await createApplication(appInput({ company: "Mistral" }), at("2026-10-01"));
    await changeStatus(id, "sent", at("2026-10-05"));

    const app = (await row<Application>("applications", { id }))!;
    expect(app.status).toBe("sent");
    expect(app.sentDate).toBe("2026-10-05");
    expect(await tasksOf(id)).toMatchObject([{ title: "Relancer Mistral", dueDate: "2026-10-15", origin: "auto_followup", doneAt: null }]);
  });

  it("utilise le délai de relance configuré", async () => {
    await testUser();
    await updateSettings({ followUpDelayDays: 14 });
    const id = await createApplication(appInput(), at("2026-10-01"));
    await changeStatus(id, "sent", at("2026-10-01"));
    expect((await tasksOf(id))[0].dueDate).toBe("2026-10-15");
  });

  it("une candidature créée directement en Envoyée a aussi sa relance", async () => {
    await testUser();
    const id = await createApplication({ ...appInput({ sentDate: "2026-09-30" }), status: "sent" }, at("2026-10-01"));
    expect(await tasksOf(id)).toMatchObject([{ dueDate: "2026-10-10", origin: "auto_followup" }]);
  });

  it("aller-retour Envoyée ↔ Relancée : pas de relance en double", async () => {
    await testUser();
    const id = await createApplication(appInput(), at("2026-10-01"));
    await changeStatus(id, "sent", at("2026-10-01"));
    await changeStatus(id, "followed_up", at("2026-10-11"));
    await changeStatus(id, "sent", at("2026-10-12"));

    const all = await tasksOf(id);
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ dueDate: "2026-10-11" });
    expect(all[0].doneAt).not.toBeNull();
    expect(all[1]).toMatchObject({ title: "Relancer Acme AI (2e relance)", dueDate: "2026-10-18", doneAt: null });
  });

  it("un entretien annule les relances en attente", async () => {
    await testUser();
    const id = await createApplication(appInput(), at("2026-10-01"));
    await changeStatus(id, "sent", at("2026-10-01"));
    await changeStatus(id, "hr_interview", at("2026-10-06"));
    const [task] = await tasksOf(id);
    expect(task.cancelledAt).toBe(at("2026-10-06").toISOString());
    expect(task.doneAt).toBeNull();
  });

  it("corriger la date d'envoi recale la relance en attente", async () => {
    await testUser();
    const id = await createApplication(appInput(), at("2026-10-10"));
    await changeStatus(id, "sent", at("2026-10-10"));
    await updateApplication(id, appInput({ sentDate: "2026-10-03" }), at("2026-10-10"));
    expect((await tasksOf(id))[0].dueDate).toBe("2026-10-13");
  });

  it("« J'ai relancé » depuis le tableau de bord", async () => {
    await testUser();
    const id = await createApplication(appInput(), at("2026-10-01"));
    await changeStatus(id, "sent", at("2026-10-01"));
    await markFollowedUp(id, at("2026-10-11"));
    expect((await row<Application>("applications", { id }))!.status).toBe("followed_up");

    // 2e relance faite : la tâche est cochée, aucune 3e n'est créée.
    await markFollowedUp(id, at("2026-10-18"));
    const all = await tasksOf(id);
    expect(all).toHaveLength(2);
    expect(all.every((t) => t.doneAt)).toBe(true);
  });

  it("refuse de modifier une candidature à la corbeille", async () => {
    await testUser();
    const id = await createApplication(appInput(), at("2026-10-01"));
    await trash(id);
    await expect(changeStatus(id, "sent")).rejects.toThrow("Candidature introuvable");
  });
});

describe("tags", () => {
  it("dédoublonne sans tenir compte de la casse et réutilise les tags existants", async () => {
    await testUser();
    const a = await createApplication(appInput({ tags: ["NLP", "nlp ", "Paris"] }));
    const b = await createApplication(appInput({ tags: ["paris"] }));
    expect((await getApplicationDetail(a))!.tags).toEqual(["NLP", "Paris"]);
    expect((await getApplicationDetail(b))!.tags).toEqual(["Paris"]);
  });

  it("modifier remplace les tags", async () => {
    await testUser();
    const id = await createApplication(appInput({ tags: ["NLP", "Paris"] }));
    await updateApplication(id, appInput({ tags: ["paris", "Vision"] }));
    expect((await getApplicationDetail(id))!.tags).toEqual(["Paris", "Vision"]);
  });
});

describe("liste", () => {
  it("une candidature à la corbeille disparaît de la liste", async () => {
    await testUser();
    const id = await createApplication(appInput(), at("2026-10-01"));
    await changeStatus(id, "sent", at("2026-10-01"));
    await trash(id);
    expect(await listApplications(at("2026-10-20"))).toEqual([]);
  });

  it("dernière activité, sans nouvelles et prochaine échéance", async () => {
    await testUser();
    const id = await createApplication(appInput({ tags: ["IA"] }), at("2026-10-01"));
    await changeStatus(id, "sent", at("2026-10-02"));
    const [item] = await listApplications(at("2026-10-20"));
    expect(item).toMatchObject({ tags: ["IA"], lastActivity: "2026-10-02", stale: true, nextDue: "2026-10-12" });
  });
});
