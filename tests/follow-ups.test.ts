import { describe, expect, it } from "vitest";
import { addDays, daysBetween, startOfWeek } from "@/lib/dates";
import { isStale, lastActivityDate, planStatusChange, type StatusChangeInput } from "@/lib/domain/follow-ups";

const base: StatusChangeInput = {
  from: "to_apply",
  to: "sent",
  company: "Acme",
  sentDate: null,
  today: "2026-10-28",
  openFollowUpTaskIds: [],
  followUpDelayDays: 10,
  secondFollowUpDelayDays: 7,
};

describe("planStatusChange", () => {
  it("passage en Envoyée : date d'envoi = aujourd'hui et relance à J+10", () => {
    expect(planStatusChange(base)).toEqual({
      sentDate: "2026-10-28",
      createTasks: [{ title: "Relancer Acme", dueDate: "2026-11-07" }],
      completeTaskIds: [],
      cancelTaskIds: [],
    });
  });

  it("garde une date d'envoi existante et calcule la relance à partir d'elle", () => {
    const plan = planStatusChange({ ...base, sentDate: "2026-10-20" });
    expect(plan.sentDate).toBeUndefined();
    expect(plan.createTasks).toEqual([{ title: "Relancer Acme", dueDate: "2026-10-30" }]);
  });

  it("respecte le délai configuré, et 0 désactive la relance", () => {
    expect(planStatusChange({ ...base, followUpDelayDays: 14 }).createTasks[0].dueDate).toBe("2026-11-11");
    expect(planStatusChange({ ...base, followUpDelayDays: 0 }).createTasks).toEqual([]);
  });

  it("ne crée pas de doublon si une relance est déjà ouverte", () => {
    expect(planStatusChange({ ...base, from: "followed_up", openFollowUpTaskIds: [4] }).createTasks).toEqual([]);
  });

  it("passage en Relancée : coche la relance ouverte et planifie la 2e", () => {
    const plan = planStatusChange({ ...base, from: "sent", to: "followed_up", sentDate: "2026-10-18", openFollowUpTaskIds: [3] });
    expect(plan.completeTaskIds).toEqual([3]);
    expect(plan.createTasks).toEqual([{ title: "Relancer Acme (2e relance)", dueDate: "2026-11-04" }]);
  });

  it("passage en entretien, offre ou statut final : annule les relances ouvertes", () => {
    for (const to of ["hr_interview", "tech_test", "tech_interview", "offer", "accepted", "rejected", "abandoned", "to_apply"] as const) {
      const plan = planStatusChange({ ...base, from: "sent", to, openFollowUpTaskIds: [3, 5] });
      expect(plan).toEqual({ createTasks: [], completeTaskIds: [], cancelTaskIds: [3, 5] });
    }
  });

  it("ne fait rien si le statut ne change pas", () => {
    expect(planStatusChange({ ...base, from: "sent" })).toEqual({ createTasks: [], completeTaskIds: [], cancelTaskIds: [] });
  });
});

describe("« sans nouvelles »", () => {
  it("prend la date d'activité la plus récente", () => {
    expect(lastActivityDate(["2026-10-01", null, "2026-10-12T10:30", undefined, "2026-10-05"])).toBe("2026-10-12");
    expect(lastActivityDate([null, undefined])).toBeNull();
  });

  it("ne concerne que les candidatures envoyées ou relancées, à partir du seuil", () => {
    const params = { lastActivity: "2026-10-18", today: "2026-10-28", staleAfterDays: 10 };
    expect(isStale({ ...params, status: "sent" })).toBe(true);
    expect(isStale({ ...params, status: "followed_up" })).toBe(true);
    expect(isStale({ ...params, status: "sent", today: "2026-10-27" })).toBe(false);
    expect(isStale({ ...params, status: "hr_interview" })).toBe(false);
    expect(isStale({ ...params, status: "to_apply" })).toBe(false);
  });
});

describe("dates", () => {
  it("additionne des jours sans être perturbé par le changement d'heure", () => {
    expect(addDays("2026-10-20", 10)).toBe("2026-10-30");
    expect(addDays("2026-03-25", 7)).toBe("2026-04-01");
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("trouve le lundi de la semaine", () => {
    expect(startOfWeek("2026-10-28")).toBe("2026-10-26");
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26");
    expect(startOfWeek("2026-10-26")).toBe("2026-10-26");
  });
});
