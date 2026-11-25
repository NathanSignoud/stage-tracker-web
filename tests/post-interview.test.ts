import { describe, expect, it } from "vitest";
import { rows } from "@/lib/db";
import type { Task } from "@/lib/types";
import { changeStatus, createApplication } from "@/services/applications";
import { createInteraction, updateInteraction, type InteractionData } from "@/services/interactions";
import { updateSettings } from "@/services/settings";
import { moveToTrash } from "@/services/trash";
import { appInput, at, testUser } from "./helpers";

// Repris de la version locale (tests/post-interview.test.ts), sur Postgres + règles RLS.

const interview = (applicationId: number, date: string, overrides: Partial<InteractionData> = {}): InteractionData => ({
  applicationId,
  contactId: null,
  date,
  type: "interview",
  interviewKind: "hr",
  durationMinutes: 45,
  summary: "Entretien RH",
  content: null,
  location: null,
  nextAction: null,
  nextActionDate: null,
  ...overrides,
});

const postInterviewTasks = (applicationId: number) => rows<Task>("tasks", { applicationId, origin: ["thank_you", "auto_followup"] });

describe("après l'entretien", () => {
  it("remerciement le lendemain et relance à J+7, liés à l'entretien", async () => {
    await testUser();
    const app = await createApplication(appInput({ company: "Mistral" }), at("2026-10-01"));
    await changeStatus(app, "sent", at("2026-10-01"));
    const id = await createInteraction(interview(app, "2026-11-04T14:00"), at("2026-10-28"));

    const open = (await postInterviewTasks(app)).filter((t) => !t.cancelledAt);
    expect(open.map((t) => [t.origin, t.title, t.dueDate, t.interactionId])).toEqual([
      ["thank_you", "Envoyer un remerciement à Mistral", "2026-11-05", id],
      ["auto_followup", "Relancer Mistral après l'entretien", "2026-11-11", id],
    ]);
    // La relance « candidature envoyée » a été annulée par le passage en entretien.
    expect((await postInterviewTasks(app)).filter((t) => t.cancelledAt).map((t) => t.title)).toEqual(["Relancer Mistral"]);
  });

  it("déplacer l'entretien déplace les tâches", async () => {
    await testUser();
    const app = await createApplication(appInput());
    const id = await createInteraction(interview(app, "2026-11-04T14:00"));
    await updateInteraction(id, interview(app, "2026-11-10T09:00"));
    expect((await postInterviewTasks(app)).map((t) => t.dueDate)).toEqual(["2026-11-11", "2026-11-17"]);
  });

  it("un nouvel entretien annule la relance du précédent ; un changement de statut aussi", async () => {
    await testUser();
    const app = await createApplication({ ...appInput(), status: "hr_interview" });
    await createInteraction(interview(app, "2026-11-04T14:00"), at("2026-10-28"));
    await createInteraction(interview(app, "2026-11-18T10:00", { interviewKind: "tech" }), at("2026-11-06"));
    const relances = (await postInterviewTasks(app)).filter((t) => t.origin === "auto_followup");
    expect(relances.map((t) => [t.dueDate, t.cancelledAt !== null])).toEqual([
      ["2026-11-11", true],
      ["2026-11-25", false],
    ]);

    await changeStatus(app, "offer", at("2026-11-20"));
    expect((await postInterviewTasks(app)).filter((t) => t.origin === "auto_followup" && !t.cancelledAt)).toEqual([]);
  });

  it("respecte les réglages (désactivation)", async () => {
    await testUser();
    await updateSettings({ thankYouReminder: false, postInterviewFollowUpDays: 0 });
    const app = await createApplication(appInput());
    await createInteraction(interview(app, "2026-11-04T14:00"));
    expect((await postInterviewTasks(app))).toEqual([]);
  });

  it("un appel ne crée rien ; un entretien mis à la corbeille emporte ses tâches", async () => {
    await testUser();
    const app = await createApplication(appInput());
    await createInteraction(interview(app, "2026-11-04T14:00", { type: "call", interviewKind: null }));
    expect((await postInterviewTasks(app))).toEqual([]);

    const id = await createInteraction(interview(app, "2026-11-05T14:00"));
    await moveToTrash("interaction", id);
    expect((await postInterviewTasks(app)).every((t) => t.deletedAt)).toBe(true);
  });
});
