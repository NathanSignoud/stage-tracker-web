import { z } from "zod";
import { STATUSES } from "@/lib/domain/constants";
import { applicationInputSchema, contactInputSchema, quickAddSchema } from "@/lib/validation";
import { changeStatus, createApplication, getApplicationDetail, markFollowedUp, updateApplication } from "@/services/applications";
import { interviewsToSchedule } from "@/services/calendar";
import { createAndLinkContact, linkContact, listContacts, requireContact, unlinkContact } from "@/services/contacts";
import { mutate } from "./result";

// Mêmes noms et mêmes contrôles que les Server Actions de la version locale : les composants s'en servent tels quels.

const id = z.coerce.number().int().positive();
const relation = z.string().trim().nullish().transform((v) => v || null);

export async function quickAddApplicationAction(input: unknown) {
  return mutate(() => createApplication(quickAddSchema.parse(input)));
}

const newApplicationSchema = applicationInputSchema.extend({ status: z.enum(STATUSES).default("to_explore") });

export async function createApplicationAction(input: unknown) {
  return mutate(() => createApplication(newApplicationSchema.parse(input)));
}

export async function updateApplicationAction(applicationId: number, input: unknown) {
  return mutate(() => updateApplication(id.parse(applicationId), applicationInputSchema.parse(input)));
}

/**
 * Change le statut. Renvoie le type d'entretien à planifier si la candidature arrive en
 * « Entretien RH / technique » sans entretien daté : l'interface demande alors la date.
 */
export async function changeStatusAction(applicationId: number, status: string) {
  return mutate(async () => {
    const appId = id.parse(applicationId);
    await changeStatus(appId, z.enum(STATUSES).parse(status));
    const pending = (await interviewsToSchedule()).find((a) => a.id === appId);
    return { scheduleKind: pending?.kind ?? null };
  });
}

/** Contacts proposés dans le dialogue « Planifier un entretien » (liés à la candidature d'abord). */
export async function interviewContactsAction(applicationId: number) {
  const [detail, all] = await Promise.all([getApplicationDetail(id.parse(applicationId)), listContacts()]);
  const linked = detail?.contacts ?? [];
  return [
    ...linked.map((c) => ({ id: c.id, name: c.name, detail: c.relation ?? c.role })),
    ...all.filter((c) => !linked.some((l) => l.id === c.id)).map((c) => ({ id: c.id, name: c.name, detail: c.company })),
  ];
}

export async function markFollowedUpAction(applicationId: number) {
  return mutate(() => markFollowedUp(id.parse(applicationId)));
}

export async function linkContactAction(applicationId: number, contactId: number, rel?: string | null) {
  return mutate(async () => {
    await requireContact(id.parse(contactId));
    await linkContact(id.parse(applicationId), contactId, relation.parse(rel));
  });
}

export async function createAndLinkContactAction(applicationId: number, input: unknown, rel?: string | null) {
  return mutate(() => createAndLinkContact(id.parse(applicationId), contactInputSchema.parse(input), relation.parse(rel)));
}

export async function unlinkContactAction(applicationId: number, contactId: number) {
  return mutate(() => unlinkContact(id.parse(applicationId), id.parse(contactId)));
}
