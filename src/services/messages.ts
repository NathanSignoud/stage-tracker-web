import { applyPlan, rows, update, type PlanOp } from "@/lib/db";
import { localDateTime } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { markFollowedUpOps, OPEN_TASK } from "./applications";
import { createInteractionOps } from "./interactions";

export type SentMessage = { templateKey: string; templateName: string; contactId: number | null; subject?: string | null; body: string };

/**
 * « Marquer comme envoyé » : l'échange est consigné dans la timeline, une relance fait passer la
 * candidature en Relancée (ou coche la relance), un remerciement coche la tâche « remerciement ». D'un bloc.
 */
export async function recordMessageSent(applicationId: number, msg: SentMessage, now = new Date()): Promise<void> {
  const ops: PlanOp[] = await createInteractionOps(
    {
      applicationId,
      contactId: msg.contactId,
      date: localDateTime(now),
      type: msg.templateKey === "linkedin" ? "linkedin" : "email_sent",
      summary: msg.templateName,
      content: [msg.subject && `Objet : ${msg.subject}`, msg.body].filter(Boolean).join("\n\n"),
      location: null,
      nextAction: null,
      nextActionDate: null,
    },
    now,
  );
  if (msg.templateKey.startsWith("follow_up")) ops.push(...(await markFollowedUpOps(applicationId, now)));
  if (msg.templateKey === "thank_you") {
    const open = (await rows<Task>("tasks", { applicationId, origin: "thank_you", ...OPEN_TASK })).map((t) => t.id);
    if (open.length) ops.push(update("tasks", { id: open }, { doneAt: now.toISOString() }));
  }
  await applyPlan(ops);
}
