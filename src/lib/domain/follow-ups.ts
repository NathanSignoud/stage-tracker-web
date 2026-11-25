import { addDays, daysBetween } from "@/lib/dates";
import { AWAITING_STATUSES, type Status } from "./constants";

export type StatusChangeInput = {
  /** null à la création de la candidature. */
  from: Status | null;
  to: Status;
  company: string;
  /** Date d'envoi déjà renseignée sur la candidature, le cas échéant. */
  sentDate: string | null;
  today: string;
  /** Identifiants des tâches de relance automatique encore ouvertes pour cette candidature. */
  openFollowUpTaskIds: number[];
  followUpDelayDays: number;
  secondFollowUpDelayDays: number;
};

export type StatusChangePlan = {
  /** Nouvelle date d'envoi à enregistrer (uniquement si elle était vide). */
  sentDate?: string;
  createTasks: { title: string; dueDate: string }[];
  completeTaskIds: number[];
  cancelTaskIds: number[];
};

/**
 * Effets de bord d'un changement de statut sur les relances automatiques.
 * - → Envoyée : date d'envoi = aujourd'hui si vide ; relance à date d'envoi + N jours (sans doublon).
 * - → Relancée : la relance ouverte est faite ; une 2e relance est planifiée à aujourd'hui + M jours.
 * - → tout autre statut : les relances automatiques encore ouvertes sont annulées.
 */
export function planStatusChange(input: StatusChangeInput): StatusChangePlan {
  const plan: StatusChangePlan = { createTasks: [], completeTaskIds: [], cancelTaskIds: [] };
  if (input.from === input.to) return plan;

  if (input.to === "sent") {
    const sentDate = input.sentDate ?? input.today;
    if (!input.sentDate) plan.sentDate = sentDate;
    if (input.openFollowUpTaskIds.length === 0 && input.followUpDelayDays > 0) {
      plan.createTasks.push({
        title: `Relancer ${input.company}`,
        dueDate: addDays(sentDate, input.followUpDelayDays),
      });
    }
  } else if (input.to === "followed_up") {
    plan.completeTaskIds = [...input.openFollowUpTaskIds];
    if (input.secondFollowUpDelayDays > 0) {
      plan.createTasks.push({
        title: `Relancer ${input.company} (2e relance)`,
        dueDate: addDays(input.today, input.secondFollowUpDelayDays),
      });
    }
  } else {
    plan.cancelTaskIds = [...input.openFollowUpTaskIds];
  }
  return plan;
}

export type InterviewTaskPlan = { origin: "thank_you" | "auto_followup"; title: string; dueDate: string };

/**
 * Tâches qui suivent un entretien : remerciement le lendemain, puis relance à J+N s'il n'y a pas
 * de nouvelles (la relance est annulée par tout changement de statut ou un nouvel entretien).
 */
export function planInterviewTasks(params: {
  company: string;
  /** `YYYY-MM-DDTHH:mm` */
  interviewDate: string;
  thankYouReminder: boolean;
  postInterviewFollowUpDays: number;
}): InterviewTaskPlan[] {
  const day = params.interviewDate.slice(0, 10);
  const plan: InterviewTaskPlan[] = [];
  if (params.thankYouReminder) {
    plan.push({ origin: "thank_you", title: `Envoyer un remerciement à ${params.company}`, dueDate: addDays(day, 1) });
  }
  if (params.postInterviewFollowUpDays > 0) {
    plan.push({
      origin: "auto_followup",
      title: `Relancer ${params.company} après l'entretien`,
      dueDate: addDays(day, params.postInterviewFollowUpDays),
    });
  }
  return plan;
}

/** Dernière date (`YYYY-MM-DD`) où il s'est passé quelque chose sur la candidature. */
export function lastActivityDate(dates: (string | null | undefined)[]): string | null {
  let last: string | null = null;
  for (const d of dates) {
    if (!d) continue;
    const day = d.slice(0, 10);
    if (!last || day > last) last = day;
  }
  return last;
}

/** Candidature envoyée ou relancée, sans aucune activité depuis `staleAfterDays` jours ou plus. */
export function isStale(params: {
  status: Status;
  lastActivity: string | null;
  today: string;
  staleAfterDays: number;
}): boolean {
  if (!AWAITING_STATUSES.includes(params.status) || !params.lastActivity) return false;
  return daysBetween(params.lastActivity, params.today) >= params.staleAfterDays;
}
