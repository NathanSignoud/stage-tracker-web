import { describe, expect, it } from "vitest";
import { applyPlan, row, update } from "@/lib/db";
import type { Application } from "@/lib/types";
import { changeStatus, createApplication, listApplications, markFollowedUp } from "@/services/applications";
import { interviewsToSchedule, listCalendarEvents } from "@/services/calendar";
import { getDashboard } from "@/services/dashboard";
import { createInteraction, type InteractionData } from "@/services/interactions";
import { moveToTrash } from "@/services/trash";
import { appInput, at, testUser } from "./helpers";

// Repris de la version locale (tests/calendar.test.ts et tableau de bord de tests/applications.test.ts).

const interview = (applicationId: number, overrides: Partial<InteractionData> = {}): InteractionData => ({
  applicationId,
  contactId: null,
  date: "2026-11-03T14:30",
  type: "interview",
  interviewKind: "hr",
  durationMinutes: 45,
  summary: "Entretien RH",
  content: null,
  location: "Teams",
  nextAction: null,
  nextActionDate: null,
  ...overrides,
});

const statusOf = async (id: number) => (await row<Application>("applications", { id }))!.status;
const trash = (id: number) => applyPlan([update("applications", { id }, { deletedAt: "2026-10-02T00:00:00.000Z" })]);

describe("entretiens", () => {
  it("planifier un entretien RH fait avancer une candidature envoyée", async () => {
    await testUser();
    const id = await createApplication(appInput(), at("2026-10-01"));
    await changeStatus(id, "sent", at("2026-10-01"));
    await createInteraction(interview(id, { interviewKind: "test", date: "2026-10-18T10:00" }), at("2026-10-19"));
    expect(await statusOf(id)).toBe("tech_test");

    await createInteraction(interview(id), at("2026-10-20"));
    expect(await statusOf(id)).toBe("hr_interview");

    await createInteraction(interview(id, { interviewKind: "tech", date: "2026-11-14T10:00" }), at("2026-10-22"));
    expect(await statusOf(id)).toBe("tech_interview");

    // Jamais de retour en arrière.
    await createInteraction(interview(id, { interviewKind: "test", date: "2026-11-16T10:00" }), at("2026-10-23"));
    await createInteraction(interview(id, { interviewKind: "hr", date: "2026-11-17T10:00" }), at("2026-10-24"));
    expect(await statusOf(id)).toBe("tech_interview");
  });

  it("ne touche pas à une candidature clôturée", async () => {
    await testUser();
    const id = await createApplication({ ...appInput(), status: "rejected" });
    await createInteraction(interview(id));
    expect(await statusOf(id)).toBe("rejected");
  });

  it("liste les candidatures en entretien sans date planifiée", async () => {
    await testUser();
    const hr = await createApplication({ ...appInput({ company: "RH sans date" }), status: "hr_interview" });
    const tech = await createApplication({ ...appInput({ company: "Tech" }), status: "hr_interview" });
    await createInteraction(interview(tech));
    expect((await interviewsToSchedule()).map((a) => [a.company, a.kind])).toEqual([["RH sans date", "hr"]]);

    // Un test technique se fait sans créneau : rien à planifier.
    const test = await createApplication({ ...appInput({ company: "Test" }), status: "tech_test" });
    expect((await interviewsToSchedule()).map((a) => a.id)).not.toContain(test);

    // Passée en technique, la candidature attend maintenant un entretien technique.
    await changeStatus(tech, "tech_interview");
    expect((await interviewsToSchedule()).map((a) => [a.company, a.kind])).toEqual([
      ["RH sans date", "hr"],
      ["Tech", "tech"],
    ]);
    await createInteraction(interview(hr));
    await createInteraction(interview(tech, { interviewKind: "tech" }));
    expect(await interviewsToSchedule()).toEqual([]);
  });
});

describe("calendrier", () => {
  it("rassemble entretiens, dates limites et tâches sur la période", async () => {
    await testUser();
    const a = await createApplication(appInput({ company: "Mistral", deadline: "2026-11-05" }));
    await createInteraction(interview(a, { nextAction: "Préparer", nextActionDate: "2026-11-02" }));
    await createInteraction(interview(a, { date: "2026-12-01T10:00" })); // hors période

    const events = await listCalendarEvents("2026-11-01", "2026-11-30");
    expect(events.map((e) => [e.kind, e.date, e.time, e.title])).toEqual([
      ["task", "2026-11-02", null, "Préparer"],
      ["interview", "2026-11-03", "14:30", "Entretien RH"],
      ["task", "2026-11-04", null, "Envoyer un remerciement à Mistral"],
      // Passée en entretien RH, la date limite de candidature ne s'affiche plus ; la relance J+7
      // du 1er entretien a été annulée par le 2e (hors période).
    ]);

    await applyPlan([update("applications", { id: a }, { status: "to_apply" })]);
    expect((await listCalendarEvents("2026-11-01", "2026-11-30", ["deadline"])).map((e) => e.company)).toEqual(["Mistral"]);

    await moveToTrash("application", a);
    expect(await listCalendarEvents("2026-11-01", "2026-11-30")).toEqual([]);
  });

  it("la frise du tableau de bord couvre les 7 prochains jours", async () => {
    await testUser();
    const a = await createApplication(appInput());
    await createInteraction(interview(a, { date: "2026-10-30T09:00" }), at("2026-10-28"));
    const d = await getDashboard(at("2026-10-28"));
    expect(d.week.map((w) => w.date)).toEqual([
      "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03",
    ]);
    expect(d.week[2].events.map((e) => e.title)).toEqual(["Entretien RH"]);
    expect(d.nextInterview?.date).toBe("2026-10-30T09:00");
    expect(d.weeklySent).toHaveLength(8);
    expect(d.activity).toHaveLength(84);
  });

  it("le prochain entretien reste affiché jusqu'à sa fin", async () => {
    await testUser();
    const a = await createApplication(appInput());
    await createInteraction(interview(a, { date: "2026-11-12T10:00", durationMinutes: 45 }), at("2026-11-01"));
    expect((await getDashboard(at("2026-11-12", "10:30"))).nextInterview?.date).toBe("2026-11-12T10:00");
    expect((await getDashboard(at("2026-11-12", "10:50"))).nextInterview).toBeNull();
  });
});

describe("tableau de bord", () => {
  it("relances dues, sans nouvelles, dates limites et entretiens à venir", async () => {
    await testUser();
    const now = at("2026-10-28");

    const due = await createApplication(appInput({ company: "Relance due" }), at("2026-10-01"));
    await changeStatus(due, "sent", at("2026-10-15"));

    const silent = await createApplication(appInput({ company: "Silence" }), at("2026-10-01"));
    await changeStatus(silent, "sent", at("2026-10-05"));
    await markFollowedUp(silent, at("2026-10-15")); // relancée le 15, 2e relance le 22 (en retard)
    await markFollowedUp(silent, at("2026-10-16")); // 2e relance faite
    const fresh = await createApplication(appInput({ company: "Récente" }), at("2026-10-26"));
    await changeStatus(fresh, "sent", at("2026-10-26"));

    await createApplication(appInput({ company: "Deadline", deadline: "2026-11-02" }), now);
    await createApplication(appInput({ company: "Trop tard", deadline: "2026-11-10" }), now);

    const interview = await createApplication({ ...appInput({ company: "Entretien" }), status: "hr_interview" }, now);
    await createInteraction({
      applicationId: interview, contactId: null, date: "2026-10-30T14:00", type: "interview",
      summary: "Entretien RH", content: null, location: null, nextAction: null, nextActionDate: null,
    }, now);

    const d = await getDashboard(now);
    expect(d.followUpsDue.map((t) => t.company)).toEqual(["Relance due"]);
    // « Relance due » est aussi sans nouvelles depuis 13 jours, mais n'est pas listée deux fois.
    expect(d.stale.map((a) => a.company)).toEqual(["Silence"]);
    expect(d.deadlines.map((a) => a.company)).toEqual(["Deadline"]);
    expect(d.appointments.map((i) => i.company)).toEqual(["Entretien"]);
    expect(d.sentThisWeek).toBe(1);
  });

  it("une candidature à la corbeille disparaît des listes et de ses tâches", async () => {
    await testUser();
    const id = await createApplication(appInput(), at("2026-10-01"));
    await changeStatus(id, "sent", at("2026-10-01"));
    await trash(id);
    const d = await getDashboard(at("2026-10-20"));
    expect(d.followUpsDue).toEqual([]);
    expect(await listApplications()).toEqual([]);
  });
});
