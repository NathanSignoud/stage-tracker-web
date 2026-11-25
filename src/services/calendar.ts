import { cmp, row, rows, upsert } from "@/lib/db";
import { localDate } from "@/lib/dates";
import { icsEventsFrom, interviewLabel, MEETING_TYPES, meetingToIcs } from "@/lib/calendar-feed";
import { STATUS_INTERVIEW_KINDS, type InterviewKind, type Status } from "@/lib/domain/constants";
import type { IcsEvent } from "@/lib/ics";
import type { Application, Contact, Interaction } from "@/lib/types";
import { isOpenTask } from "./applications";
import { getRawSetting } from "./settings";
import { allApplications, allContacts, allInteractions, allTasks } from "./tables";

export const CALENDAR_EVENT_KINDS = ["interview", "deadline", "task"] as const;
export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

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

export { interviewLabel };

/** Entretiens / appels, dates limites et tâches entre deux dates (incluses). */
export async function listCalendarEvents(
  from: string,
  to: string,
  kinds: readonly CalendarEventKind[] = CALENDAR_EVENT_KINDS,
): Promise<CalendarEvent[]> {
  const [apps, interactions, contacts, tasks] = await Promise.all([
    allApplications(),
    kinds.includes("interview") ? allInteractions().then((all) => all.filter((i) => !i.deletedAt && MEETING_TYPES.includes(i.type))) : [],
    kinds.includes("interview") ? allContacts() : [],
    kinds.includes("task") ? allTasks().then((t) => t.filter(isOpenTask)) : [],
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
  const [apps, interactions] = await Promise.all([allApplications(), allInteractions()]);
  const pending = apps.filter((a) => !a.deletedAt && a.status in STATUS_INTERVIEW_KINDS);
  const scheduled = interactions.filter((i) => !i.deletedAt && i.type === "interview");
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

/** Événements exportés : entretiens et appels (90 derniers jours → futur) + dates limites à venir. */
export async function listIcsEvents(baseUrl: string, now = new Date()): Promise<IcsEvent[]> {
  const [interactions, applications, contacts] = await Promise.all([
    rows<Interaction>("interactions", { deletedAt: null, type: MEETING_TYPES }), // avec le compte rendu (description)
    allApplications(),
    allContacts(),
  ]);
  return icsEventsFrom({ interactions, applications, contacts }, baseUrl, localDate(now));
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

// --- Jeton de l'abonnement ----------------------------------------------------

/** 18 octets aléatoires en base64url (24 caractères) : l'adresse d'abonnement est impossible à deviner. */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Jeton secret de l'adresse d'abonnement (créé au premier besoin). */
export async function getCalendarToken(): Promise<string> {
  return (await getRawSetting<string>("calendarToken")) ?? regenerateCalendarToken();
}

/** Nouveau jeton (l'ancienne adresse cesse de marcher) ; le fuseau sert au serveur à placer les heures. */
export async function regenerateCalendarToken(): Promise<string> {
  const token = newToken();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await upsert("settings", [{ key: "calendarToken", value: token }, { key: "calendarTimeZone", value: timeZone }], ["userId", "key"]);
  return token;
}
