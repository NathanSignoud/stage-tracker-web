import { describe, expect, it } from "vitest";
import { rows } from "@/lib/db";
import type { Task } from "@/lib/types";
import { createApplication, getApplicationDetail } from "@/services/applications";
import { createInteraction, updateInteraction, type InteractionData } from "@/services/interactions";
import { listTrash, moveToTrash, purgeFromTrash, restoreFromTrash } from "@/services/trash";
import { appInput, at, testUser } from "./helpers";

// Repris de la version locale (tests/interactions-trash.test.ts), sur Postgres + règles RLS.

const exchange = (applicationId: number, overrides: Partial<InteractionData> = {}): InteractionData => ({
  applicationId,
  contactId: null,
  date: "2026-10-20T10:00",
  type: "call",
  summary: "Appel RH",
  content: null,
  location: null,
  nextAction: null,
  nextActionDate: null,
  ...overrides,
});

describe("prochaine action d'un échange", () => {
  it("crée une tâche liée, la met à jour, puis l'annule si l'action est retirée", async () => {
    await testUser();
    const app = await createApplication(appInput());
    const id = await createInteraction(exchange(app, { nextAction: "Envoyer le portfolio", nextActionDate: "2026-10-22" }), at("2026-10-20"));

    const linked = () => rows<Task>("tasks", { interactionId: id });
    expect(await linked()).toMatchObject([{ title: "Envoyer le portfolio", dueDate: "2026-10-22", origin: "interaction", applicationId: app }]);

    await updateInteraction(id, exchange(app, { nextAction: "Envoyer le portfolio + GitHub", nextActionDate: "2026-10-23" }));
    expect(await linked()).toHaveLength(1);
    expect((await linked())[0]).toMatchObject({ title: "Envoyer le portfolio + GitHub", dueDate: "2026-10-23" });

    await updateInteraction(id, exchange(app), at("2026-10-21"));
    expect((await linked())[0].cancelledAt).toBe(at("2026-10-21").toISOString());
  });

  it("pas de tâche sans prochaine action", async () => {
    await testUser();
    const app = await createApplication(appInput());
    await createInteraction(exchange(app));
    expect(await rows<Task>("tasks")).toEqual([]);
  });
});

describe("corbeille", () => {
  it("un échange part à la corbeille avec sa tâche, et revient avec elle", async () => {
    await testUser();
    const app = await createApplication(appInput());
    const id = await createInteraction(exchange(app, { nextAction: "Rappeler" }));

    await moveToTrash("interaction", id, at("2026-10-21"));
    expect((await getApplicationDetail(app))!.interactions).toEqual([]);
    expect((await getApplicationDetail(app))!.tasks).toEqual([]);
    expect((await listTrash()).map((i) => i.kind)).toEqual(["interaction"]);

    await restoreFromTrash("interaction", id);
    expect((await getApplicationDetail(app))!.interactions).toHaveLength(1);
    expect((await getApplicationDetail(app))!.tasks).toHaveLength(1);
  });

  it("ne supprime définitivement que ce qui est déjà dans la corbeille", async () => {
    await testUser();
    const app = await createApplication(appInput());
    await expect(purgeFromTrash("application", app)).rejects.toThrow(/corbeille/);

    await moveToTrash("application", app);
    await purgeFromTrash("application", app);
    expect(await getApplicationDetail(app)).toBeNull();
    expect(await listTrash()).toEqual([]);
  });
});
