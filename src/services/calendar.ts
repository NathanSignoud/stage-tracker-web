import { cmp, row, rows } from "@/lib/db";
import { addDays, localDate } from "@/lib/dates";
import {
  DEFAULT_INTERVIEW_MINUTES,
  INTERACTION_LABELS,
  INTERVIEW_KIND_LABELS,
  STATUS_INTERVIEW_KINDS,
  type InteractionType,
  type InterviewKind,
  type Status,
} from "@/lib/domain/constants";
import { sequenceFrom, type IcsEvent } from "@/lib/ics";
import type { Application, Contact, Interaction, Task } from "@/lib/types";
import { OPEN_TASK } from "./applications";

export const CALENDAR_EVENT_KINDS = ["interview", "deadline", "task"] as const;
export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

/** Types d'échange qui sont des rendez-vous (affichés dans le calendrier). */
const MEETING_TYPES: InteractionType[] = ["interview", "call", "meeting"];

export type CalendarEvent = {
  key: string;
  kind: CalendarEventKind;
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:mm`, null pour une journée entière. */
  time: string | null;
  durationMinutes: number | null;
  title: string;
  company: string | null;
  applicationId: number | null;
  interactionId: number | null;
  location: string | null;
  contactName: string | null;
};

export function interviewLabel(type: InteractionType, kind: InterviewKind | null): string {
  if (type === "interview") return INTERVIEW_KIND_LABELS[kind ?? "other"];
  return INTERACTION_LABELS[type];
}

/** Entretiens / appels, dates limites et tâches entre deux dates (incluses). */
export async function listCalendarEvents(
  from: string,
  to: string,
  kinds: readonly CalendarEventKind[] = CALENDAR_EVENT_KINDS,
): Promise<CalendarEvent[]> {
  const [apps, interactions, contacts, tasks] = await Promise.all([
    rows<Application>("applications"),
    kinds.includes("interview") ? rows<Interaction>("interactions", { deletedAt: null, type: MEETING_TYPES }) : [],
    kinds.includes("interview") ? rows<Contact>("contacts") : [],
    kinds.includes("task") ? rows<Task>("tasks", OPEN_TASK) : [],
  ]);
  const appById = new Map(apps.map((a) => [a.id, a]));
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));
  const appOf = (id: number | null) => (id ? appById.get(id) : undefined);
  const base = { time: null, durationMinutes: null, interactionId: null, location: null, contactName: null };
  const events: CalendarEvent[] = [];

  for (const i of interactions) {
    if (i.date < `${from}T00:00` || i.date > `${to}T23:59` || appOf(i.applicationId)?.deletedAt) continue;
    events.push({
      key: `i${i.id}`,
      kind: "interview",
      date: i.date.slice(0, 10),
      time: i.date.slice(11, 16),
      durationMinutes: i.durationMinutes,
      title: interviewLabel(i.type, i.interviewKind),
      company: appOf(i.applicationId)?.company ?? null,
      applicationId: i.applicationId,
      interactionId: i.id,
      location: i.location,
      contactName: (i.contactId && contactName.get(i.contactId)) || null,
    });
  }
  if (kinds.includes("deadline")) {
    for (const a of apps) {
      if (a.deletedAt || !["to_explore", "to_apply"].includes(a.status) || !a.deadline || a.deadline < from || a.deadline > to) continue;
      events.push({ ...base, key: `d${a.id}`, kind: "deadline", date: a.deadline, title: "Date limite", company: a.company, applicationId: a.id });
    }
  }
  for (const t of tasks) {
    if (!t.dueDate || t.dueDate < from || t.dueDate > to || appOf(t.applicationId)?.deletedAt) continue;
    events.push({
      ...base,
      key: `t${t.id}`,
      kind: "task",
      date: t.dueDate,
      title: t.title,
      company: appOf(t.applicationId)?.company ?? null,
      applicationId: t.applicationId,
    });
  }
  return events.sort((a, b) => cmp(`${a.date}${a.time ?? "00:00"}`, `${b.date}${b.time ?? "00:00"}`));
}

/**
 * Candidatures au stade « Entretien RH » ou « Entretien technique » sans entretien
 * correspondant planifié : il faut y mettre une date.
 */
export async function interviewsToSchedule() {
  const pending = await rows<Application>("applications", { deletedAt: null, status: Object.keys(STATUS_INTERVIEW_KINDS) });
  if (!pending.length) return [];
  const scheduled = await rows<Interaction>("interactions", { deletedAt: null, type: "interview", applicationId: pending.map((a) => a.id) });
  return pending
    .filter((a) => {
      const expected = STATUS_INTERVIEW_KINDS[a.status as Status] ?? [];
      // Un entretien sans type précisé compte pour n'importe quel stade.
      return !scheduled.some((s) => s.applicationId === a.id && (!s.interviewKind || expected.includes(s.interviewKind)));
    })
    .map((a) => ({
      id: a.id,
      company: a.company,
      title: a.title,
      status: a.status,
      kind: (STATUS_INTERVIEW_KINDS[a.status]?.[0] ?? "other") as InterviewKind,
    }));
}

export type InterviewToSchedule = Awaited<ReturnType<typeof interviewsToSchedule>>[number];

// --- Export iCalendar --------------------------------------------------------

function meetingToIcs(i: Interaction, app: Application | undefined, contactName: string | null, baseUrl: string): IcsEvent {
  const label = interviewLabel(i.type, i.interviewKind);
  const ficheUrl = i.applicationId ? `${baseUrl}/candidatures/${i.applicationId}` : null;
  const description = [
    app?.title && `Poste : ${app.title}`,
    contactName && `Contact : ${contactName}`,
    i.summary !== label && i.summary,
    i.content && i.content.slice(0, 1500),
    ficheUrl && `Fiche : ${ficheUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  const isInterview = i.type === "interview";
  return {
    uid: `interaction-${i.id}@stage-tracker`,
    start: i.date,
    durationMinutes: i.durationMinutes ?? (isInterview ? DEFAULT_INTERVIEW_MINUTES : 30),
    title: app ? `${label} · ${app.company}` : label,
    description,
    location: i.location,
    url: ficheUrl,
    sequence: sequenceFrom(i.updatedAt),
    // Rappels : la veille (pour préparer) et 1 h avant pour un entretien ; 15 min avant pour un appel.
    alarms: isInterview ? [24 * 60, 60] : [15],
  };
}

/** Événements exportés : entretiens et appels (90 derniers jours → futur) + dates limites à venir. */
export async function listIcsEvents(baseUrl: string, now = new Date()): Promise<IcsEvent[]> {
  const today = localDate(now);
  const [interactions, apps, contacts, deadlines] = await Promise.all([
    rows<Interaction>("interactions", { deletedAt: null, type: MEETING_TYPES }),
    rows<Application>("applications"),
    rows<Contact>("contacts"),
    listCalendarEvents(today, addDays(today, 365), ["deadline"]),
  ]);
  const appById = new Map(apps.map((a) => [a.id, a]));
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));
  const meetings = interactions
    .filter((i) => i.date >= `${addDays(today, -90)}T00:00` && !(i.applicationId && appById.get(i.applicationId)?.deletedAt))
    .map((i) =>
      meetingToIcs(i, i.applicationId ? appById.get(i.applicationId) : undefined, (i.contactId && contactName.get(i.contactId)) || null, baseUrl),
    );
  return [
    ...meetings,
    ...deadlines.map((e) => ({
      uid: `deadline-${e.applicationId}@stage-tracker`,
      start: e.date,
      allDay: true,
      title: `Date limite · ${e.company}`,
      url: `${baseUrl}/candidatures/${e.applicationId}`,
    })),
  ];
}

/** Un seul entretien / appel, pour le bouton « Ajouter à mon agenda ». */
export async function getInteractionIcsEvent(interactionId: number, baseUrl: string): Promise<IcsEvent | null> {
  const i = await row<Interaction>("interactions", { id: interactionId });
  if (!i || i.deletedAt) return null;
  const [app, contact] = await Promise.all([
    i.applicationId ? row<Application>("applications", { id: i.applicationId }) : null,
    i.contactId ? row<Contact>("contacts", { id: i.contactId }) : null,
  ]);
  return meetingToIcs(i, app ?? undefined, contact?.name ?? null, baseUrl);
}
