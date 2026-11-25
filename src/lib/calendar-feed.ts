import { addDays } from "@/lib/dates";
import { DEFAULT_INTERVIEW_MINUTES, INTERACTION_LABELS, INTERVIEW_KIND_LABELS, type InteractionType, type InterviewKind } from "@/lib/domain/constants";
import { sequenceFrom, type IcsEvent } from "@/lib/ics";

// Fabrication des événements iCalendar à partir des lignes déjà chargées (aucun accès à la base) :
// sert au site (téléchargement .ics) et au serveur (abonnement agenda, worker/calendar.ts).

/** Types d'échange qui sont des rendez-vous (affichés dans le calendrier). */
export const MEETING_TYPES: InteractionType[] = ["interview", "call", "meeting"];

export function interviewLabel(type: InteractionType, kind: InterviewKind | null): string {
  if (type === "interview") return INTERVIEW_KIND_LABELS[kind ?? "other"];
  return INTERACTION_LABELS[type];
}

export type FeedInteraction = {
  id: number;
  applicationId: number | null;
  contactId: number | null;
  date: string;
  type: InteractionType;
  interviewKind: InterviewKind | null;
  summary: string;
  content: string | null;
  location: string | null;
  durationMinutes: number | null;
  updatedAt: string;
};
export type FeedApplication = { id: number; company: string; title: string; status: string; deadline: string | null; deletedAt: string | null };
export type FeedContact = { id: number; name: string };

export function meetingToIcs(i: FeedInteraction, app: FeedApplication | undefined, contactName: string | null, baseUrl: string): IcsEvent {
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

/** Événements exportés : entretiens et appels (90 derniers jours → futur) + dates limites de l'année à venir. */
export function icsEventsFrom(
  data: { interactions: FeedInteraction[]; applications: FeedApplication[]; contacts: FeedContact[] },
  baseUrl: string,
  today: string,
): IcsEvent[] {
  const appById = new Map(data.applications.map((a) => [a.id, a]));
  const contactName = new Map(data.contacts.map((c) => [c.id, c.name]));
  const meetings = data.interactions
    .filter((i) => MEETING_TYPES.includes(i.type) && i.date >= `${addDays(today, -90)}T00:00` && !(i.applicationId && appById.get(i.applicationId)?.deletedAt))
    .map((i) => meetingToIcs(i, i.applicationId ? appById.get(i.applicationId) : undefined, (i.contactId && contactName.get(i.contactId)) || null, baseUrl));
  const lastDay = addDays(today, 365);
  const deadlines = data.applications
    .filter((a) => !a.deletedAt && (a.status === "to_explore" || a.status === "to_apply") && a.deadline && a.deadline >= today && a.deadline <= lastDay)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
    .map((a) => ({
      uid: `deadline-${a.id}@stage-tracker`,
      start: a.deadline!,
      allDay: true,
      title: `Date limite · ${a.company}`,
      url: `${baseUrl}/candidatures/${a.id}`,
    }));
  return [...meetings, ...deadlines];
}
