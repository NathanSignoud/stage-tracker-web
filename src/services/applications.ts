import { applyPlan, cmp, insert, ref, remove, row, rows, update, type PlanOp } from "@/lib/db";
import { addDays, isoToLocalDate, localDate, localDateTime } from "@/lib/dates";
import type { Status } from "@/lib/domain/constants";
import { isStale, lastActivityDate, planStatusChange } from "@/lib/domain/follow-ups";
import type { ImportedOffer } from "@/lib/domain/offer-parsing";
import type { Application, Contact, Document, Interaction, StatusChange, Tag, Task } from "@/lib/types";
import type { ApplicationInput, QuickAddInput } from "@/lib/validation";
import { scoreOffer } from "./keywords";
import { getSettings } from "./settings";

export class NotFoundError extends Error {
  constructor(what = "Élément introuvable") {
    super(what);
  }
}

/** Tâche ouverte : ni faite, ni annulée, ni à la corbeille. */
export const isOpenTask = (t: Task) => !t.doneAt && !t.cancelledAt && !t.deletedAt;
export const OPEN_TASK = { doneAt: null, cancelledAt: null, deletedAt: null };

export async function openFollowUpTaskIds(applicationId: number): Promise<number[]> {
  return (await rows<Task>("tasks", { applicationId, origin: "auto_followup", ...OPEN_TASK })).map((t) => t.id);
}

/** Écritures d'un changement de statut d'une candidature existante (historique + relances automatiques). */
export async function statusChangeOps(
  app: Pick<Application, "id" | "company" | "sentDate">,
  from: Status | null,
  to: Status,
  now: Date,
): Promise<PlanOp[]> {
  const [settings, openIds] = await Promise.all([getSettings(), openFollowUpTaskIds(app.id)]);
  const nowIso = now.toISOString();
  const plan = planStatusChange({
    from,
    to,
    company: app.company,
    sentDate: app.sentDate,
    today: localDate(now),
    openFollowUpTaskIds: openIds,
    followUpDelayDays: settings.followUpDelayDays,
    secondFollowUpDelayDays: settings.secondFollowUpDelayDays,
  });
  return [
    update("applications", { id: app.id }, { status: to, updatedAt: nowIso, ...(plan.sentDate ? { sentDate: plan.sentDate } : {}) }),
    insert("status_changes", { applicationId: app.id, fromStatus: from, toStatus: to, changedAt: nowIso }),
    ...plan.createTasks.map((t) => insert("tasks", { ...t, applicationId: app.id, origin: "auto_followup", createdAt: nowIso })),
    ...(plan.completeTaskIds.length ? [update("tasks", { id: plan.completeTaskIds }, { doneAt: nowIso })] : []),
    ...(plan.cancelTaskIds.length ? [update("tasks", { id: plan.cancelTaskIds }, { cancelledAt: nowIso })] : []),
  ];
}

/**
 * Écritures qui remplacent les étiquettes d'une candidature (étiquettes créées au besoin, casse ignorée).
 * `base` : position de la première de ces écritures dans le plan (pour référencer les étiquettes créées).
 */
async function tagOps(applicationId: number | ReturnType<typeof ref>, names: string[], base: number): Promise<PlanOp[]> {
  const unique = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim();
    if (name && !unique.has(name.toLowerCase())) unique.set(name.toLowerCase(), name);
  }
  const existing = await rows<Tag>("tags");
  const ops: PlanOp[] = typeof applicationId === "number" ? [remove("application_tags", { applicationId })] : [];
  for (const name of unique.values()) {
    const tag = existing.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (tag) {
      ops.push(insert("application_tags", { applicationId, tagId: tag.id }));
    } else {
      ops.push(insert("tags", { name }));
      ops.push(insert("application_tags", { applicationId, tagId: ref(base + ops.length - 1) }));
    }
  }
  return ops;
}

/**
 * Écritures qui créent une candidature (avec son historique, ses relances et ses tags).
 * `base` : position de la première de ces écritures dans le plan (l'insertion de la candidature).
 */
export async function createApplicationOps(
  input: (ApplicationInput | QuickAddInput) & { status?: Status },
  now: Date,
  base = 0,
): Promise<PlanOp[]> {
  const { tags: tagNames, status = "to_explore", ...fields } = input as ApplicationInput & { status?: Status };
  const nowIso = now.toISOString();
  const [settings, matchScore] = await Promise.all([getSettings(), scoreOffer(fields.offerText)]);
  const plan = planStatusChange({
    from: null,
    to: status,
    company: fields.company,
    sentDate: fields.sentDate ?? null,
    today: localDate(now),
    openFollowUpTaskIds: [],
    followUpDelayDays: settings.followUpDelayDays,
    secondFollowUpDelayDays: settings.secondFollowUpDelayDays,
  });
  const appId = ref(base);
  const ops: PlanOp[] = [
    insert("applications", { ...fields, status, matchScore, createdAt: nowIso, updatedAt: nowIso, ...(plan.sentDate ? { sentDate: plan.sentDate } : {}) }),
    insert("status_changes", { applicationId: appId, fromStatus: null, toStatus: status, changedAt: nowIso }),
    ...plan.createTasks.map((t) => insert("tasks", { ...t, applicationId: appId, origin: "auto_followup", createdAt: nowIso })),
  ];
  if (tagNames) ops.push(...(await tagOps(appId, tagNames, base + ops.length)));
  return ops;
}

export async function createApplication(input: (ApplicationInput | QuickAddInput) & { status?: Status }, now = new Date()): Promise<number> {
  return (await applyPlan(await createApplicationOps(input, now)))[0]!;
}

export async function updateApplication(id: number, input: ApplicationInput, now = new Date()): Promise<void> {
  const app = await getLiveApplication(id);
  const { tags: tagNames, ...fields } = input;
  const ops: PlanOp[] = [update("applications", { id }, { ...fields, matchScore: await scoreOffer(fields.offerText), updatedAt: now.toISOString() })];
  if (tagNames) ops.push(...(await tagOps(id, tagNames, ops.length)));

  // Date d'envoi corrigée alors que la 1re relance est en attente : on recale son échéance.
  if (app.status === "sent" && fields.sentDate && fields.sentDate !== app.sentDate) {
    const [{ followUpDelayDays }, ids] = await Promise.all([getSettings(), openFollowUpTaskIds(id)]);
    if (ids.length && followUpDelayDays > 0) ops.push(update("tasks", { id: ids }, { dueDate: addDays(fields.sentDate, followUpDelayDays) }));
  }
  await applyPlan(ops);
}

/** Remplace uniquement le texte de l'offre (collé ou importé) et recalcule le score. */
export async function setOfferText(id: number, text: string | null, now = new Date()): Promise<void> {
  await getLiveApplication(id);
  const offerText = text?.trim() ? text.trim() : null;
  await applyPlan([update("applications", { id }, { offerText, matchScore: await scoreOffer(offerText), updatedAt: now.toISOString() })]);
}

/** Texte de l'offre importé depuis son lien ; les champs déjà remplis sont gardés. */
export async function applyImportedOffer(app: Application, offer: ImportedOffer, now = new Date()): Promise<void> {
  const offerText = offer.offerText?.trim() || null;
  await applyPlan([
    update("applications", { id: app.id }, {
      offerText,
      matchScore: await scoreOffer(offerText),
      location: app.location ?? offer.location,
      deadline: app.deadline ?? offer.deadline,
      remote: app.remote ?? offer.remote,
      title: app.title || offer.title || "",
      updatedAt: now.toISOString(),
    }),
  ]);
}

export async function changeStatus(id: number, to: Status, now = new Date()): Promise<void> {
  const app = await getLiveApplication(id);
  if (app.status === to) return;
  await applyPlan(await statusChangeOps(app, app.status, to, now));
}

/**
 * « J'ai relancé » depuis le tableau de bord : passe la candidature en Relancée si elle était
 * Envoyée (ce qui planifie la 2e relance), sinon coche simplement les relances ouvertes.
 */
export async function markFollowedUp(id: number, now = new Date()): Promise<void> {
  await applyPlan(await markFollowedUpOps(id, now));
}

export async function markFollowedUpOps(id: number, now: Date): Promise<PlanOp[]> {
  const app = await getLiveApplication(id);
  if (app.status === "sent") return statusChangeOps(app, app.status, "followed_up", now);
  const ids = await openFollowUpTaskIds(id);
  return ids.length ? [update("tasks", { id: ids }, { doneAt: now.toISOString() })] : [];
}

export async function getLiveApplication(id: number): Promise<Application> {
  const app = await row<Application>("applications", { id });
  if (!app || app.deletedAt) throw new NotFoundError("Candidature introuvable");
  return app;
}

export async function listTagNames(): Promise<string[]> {
  return (await rows<Tag>("tags")).map((t) => t.name).sort(cmp);
}

export type ApplicationListItem = Application & {
  tags: string[];
  lastActivity: string | null;
  stale: boolean;
  /** Échéance la plus proche parmi les tâches ouvertes. */
  nextDue: string | null;
};

type Link = { applicationId: number; tagId: number };

export async function listApplications(now = new Date()): Promise<ApplicationListItem[]> {
  const today = localDate(now);
  const nowLocal = localDateTime(now);
  const [apps, links, tags, changes, interactions, openTasks, { staleAfterDays }] = await Promise.all([
    rows<Application>("applications", { deletedAt: null }),
    rows<Link>("application_tags"),
    rows<Tag>("tags"),
    rows<StatusChange>("status_changes"),
    rows<Interaction>("interactions", { deletedAt: null }),
    rows<Task>("tasks", OPEN_TASK),
    getSettings(),
  ]);

  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const tagsByApp = new Map<number, string[]>();
  for (const l of links) tagsByApp.set(l.applicationId, [...(tagsByApp.get(l.applicationId) ?? []), tagName.get(l.tagId)!]);
  const latest = (map: Map<number, string>, id: number | null, value: string | null, keep: (a: string, b: string) => boolean) => {
    if (id == null || value == null) return;
    const current = map.get(id);
    if (current === undefined || keep(value, current)) map.set(id, value);
  };
  const lastChange = new Map<number, string>();
  for (const c of changes) latest(lastChange, c.applicationId, c.changedAt, (a, b) => a > b);
  const lastInteraction = new Map<number, string>();
  for (const i of interactions) if (i.date <= nowLocal) latest(lastInteraction, i.applicationId, i.date, (a, b) => a > b);
  const nextDue = new Map<number, string>();
  for (const t of openTasks) latest(nextDue, t.applicationId, t.dueDate, (a, b) => a < b);

  return apps
    .sort((a, b) => cmp(a.priority, b.priority) || cmp(b.updatedAt, a.updatedAt))
    .map((app) => {
      const changed = lastChange.get(app.id);
      const lastActivity = lastActivityDate([app.sentDate, changed && isoToLocalDate(changed), lastInteraction.get(app.id)]);
      return {
        ...app,
        tags: (tagsByApp.get(app.id) ?? []).sort(cmp),
        lastActivity,
        stale: isStale({ status: app.status, lastActivity, today, staleAfterDays }),
        nextDue: nextDue.get(app.id) ?? null,
      };
    });
}

export async function getApplicationDetail(id: number) {
  const application = await row<Application>("applications", { id });
  if (!application) return null;

  const [links, tags, history, interactions, contacts, contactLinks, documents, documentLinks, tasks] = await Promise.all([
    rows<Link>("application_tags", { applicationId: id }),
    rows<Tag>("tags"),
    rows<StatusChange>("status_changes", { applicationId: id }),
    rows<Interaction>("interactions", { applicationId: id, deletedAt: null }),
    rows<Contact>("contacts"),
    rows<{ contactId: number; relation: string | null }>("application_contacts", { applicationId: id }),
    rows<Document>("documents", { deletedAt: null }),
    rows<{ documentId: number; sentAt: string | null }>("application_documents", { applicationId: id }),
    rows<Task>("tasks", { applicationId: id, deletedAt: null }),
  ]);
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const tagIds = new Set(links.map((l) => l.tagId));

  return {
    application,
    tags: tags.filter((t) => tagIds.has(t.id)).map((t) => t.name).sort(cmp),
    history: history.sort((a, b) => cmp(a.changedAt, b.changedAt) || cmp(a.id, b.id)),
    interactions: interactions
      .sort((a, b) => cmp(b.date, a.date))
      .map((i) => ({ ...i, contactName: (i.contactId && contactById.get(i.contactId)?.name) || null })),
    contacts: contactLinks
      .flatMap((l) => {
        const c = contactById.get(l.contactId);
        return c && !c.deletedAt ? [{ ...c, relation: l.relation }] : [];
      })
      .sort((a, b) => cmp(a.name, b.name)),
    documents: documentLinks
      .flatMap((l) => {
        const d = documents.find((doc) => doc.id === l.documentId);
        return d ? [{ ...d, sentAt: l.sentAt }] : [];
      })
      .sort((a, b) => cmp(b.sentAt, a.sentAt)),
    tasks: tasks.sort((a, b) => cmp(!isOpenTask(a), !isOpenTask(b)) || cmp(a.dueDate, b.dueDate)),
  };
}

export type ApplicationDetail = NonNullable<Awaited<ReturnType<typeof getApplicationDetail>>>;
