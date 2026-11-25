import { applyPlan, insert, ref, row, rows, update, type PlanOp } from "@/lib/db";
import { CLOSED_STATUSES, INTERVIEW_KIND_STATUS, STATUSES } from "@/lib/domain/constants";
import { planInterviewTasks } from "@/lib/domain/follow-ups";
import type { Application, Interaction, Task } from "@/lib/types";
import type { InteractionInput } from "@/lib/validation";
import { isOpenTask, NotFoundError, openFollowUpTaskIds, statusChangeOps } from "./applications";
import { getSettings } from "./settings";

/** Saisie d'un échange ; type d'entretien et durée sont facultatifs. */
export type InteractionData = Omit<InteractionInput, "interviewKind" | "durationMinutes"> &
  Partial<Pick<InteractionInput, "interviewKind" | "durationMinutes">>;

type InteractionId = number | ReturnType<typeof ref>;

/** Le type d'entretien n'a de sens que pour un échange de type « entretien ». */
function normalize(input: InteractionData): InteractionInput {
  return {
    ...input,
    interviewKind: input.type === "interview" ? (input.interviewKind ?? null) : null,
    durationMinutes: input.durationMinutes ?? null,
  };
}

/**
 * Planifier un entretien RH / technique fait avancer la candidature au statut correspondant
 * (jamais de retour en arrière, jamais depuis un statut final).
 */
async function advanceStatusOps(input: InteractionInput, now: Date): Promise<PlanOp[]> {
  const target = input.interviewKind && INTERVIEW_KIND_STATUS[input.interviewKind];
  if (!target || !input.applicationId) return [];
  const app = await row<Application>("applications", { id: input.applicationId });
  if (!app || app.deletedAt || CLOSED_STATUSES.includes(app.status)) return [];
  return STATUSES.indexOf(app.status) < STATUSES.indexOf(target) ? statusChangeOps(app, app.status, target, now) : [];
}

export async function createInteraction(raw: InteractionData, now = new Date()): Promise<number> {
  const input = normalize(raw);
  const nowIso = now.toISOString();
  const ops: PlanOp[] = [insert("interactions", { ...input, createdAt: nowIso, updatedAt: nowIso })];
  ops.push(...nextActionTaskOps(ref(0), [], input, nowIso));
  ops.push(...(await advanceStatusOps(input, now)));
  ops.push(...(await interviewTaskOps(ref(0), [], input, nowIso, true)));
  return (await applyPlan(ops))[0]!;
}

export async function updateInteraction(id: number, raw: InteractionData, now = new Date()): Promise<void> {
  const input = normalize(raw);
  const existing = await row<Interaction>("interactions", { id });
  if (!existing || existing.deletedAt) throw new NotFoundError("Échange introuvable");
  const linked = await rows<Task>("tasks", { interactionId: id });
  const nowIso = now.toISOString();
  await applyPlan([
    update("interactions", { id }, { ...input, updatedAt: nowIso }),
    ...nextActionTaskOps(id, linked, input, nowIso),
    ...(await advanceStatusOps(input, now)),
    ...(await interviewTaskOps(id, linked, input, nowIso, false)),
  ]);
}

/**
 * Après un entretien : remerciement (J+1) et relance (J+N), liés à l'entretien pour suivre ses
 * changements de date. Un nouvel entretien annule les relances automatiques encore ouvertes
 * (il y a eu des nouvelles).
 */
async function interviewTaskOps(
  interactionId: InteractionId,
  linkedTasks: Task[],
  input: InteractionInput,
  nowIso: string,
  isNew: boolean,
): Promise<PlanOp[]> {
  const linked = linkedTasks.filter((t) => t.origin === "thank_you" || t.origin === "auto_followup");

  if (input.type !== "interview" || !input.applicationId) {
    const open = linked.filter((t) => !t.doneAt && !t.cancelledAt && !t.deletedAt).map((t) => t.id);
    return open.length ? [update("tasks", { id: open }, { cancelledAt: nowIso })] : [];
  }

  const app = await row<Application>("applications", { id: input.applicationId });
  if (!app) return [];
  const ops: PlanOp[] = [];
  if (isNew) {
    const open = await openFollowUpTaskIds(app.id);
    if (open.length) ops.push(update("tasks", { id: open }, { cancelledAt: nowIso }));
  }
  const settings = await getSettings();
  for (const planned of planInterviewTasks({
    company: app.company,
    interviewDate: input.date,
    thankYouReminder: settings.thankYouReminder,
    postInterviewFollowUpDays: settings.postInterviewFollowUpDays,
  })) {
    const existing = linked.find((t) => t.origin === planned.origin);
    if (!existing) {
      if (isNew) ops.push(insert("tasks", { ...planned, applicationId: app.id, interactionId, createdAt: nowIso }));
    } else if (!existing.doneAt && !existing.cancelledAt) {
      ops.push(update("tasks", { id: existing.id }, { title: planned.title, dueDate: planned.dueDate }));
    }
  }
  return ops;
}

/**
 * La « prochaine action » d'un échange est matérialisée par une tâche liée, pour apparaître
 * dans le tableau de bord. Elle suit les modifications de l'échange tant qu'elle est ouverte.
 */
function nextActionTaskOps(interactionId: InteractionId, linkedTasks: Task[], input: InteractionInput, nowIso: string): PlanOp[] {
  const open = linkedTasks.find((t) => t.origin === "interaction" && isOpenTask(t));
  if (input.nextAction) {
    const values = { title: input.nextAction, dueDate: input.nextActionDate, applicationId: input.applicationId };
    return [open ? update("tasks", { id: open.id }, values) : insert("tasks", { ...values, interactionId, origin: "interaction", createdAt: nowIso })];
  }
  return open ? [update("tasks", { id: open.id }, { cancelledAt: nowIso })] : [];
}
