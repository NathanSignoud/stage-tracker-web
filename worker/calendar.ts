import { icsEventsFrom, type FeedApplication, type FeedContact, type FeedInteraction } from "../src/lib/calendar-feed";
import { buildCalendar } from "../src/lib/ics";
import type { Env } from "./http";

// Abonnement agenda (webcal) : Outlook / Google / Apple Calendrier relisent cette adresse régulièrement.
// Le jeton secret de l'adresse identifie la personne ; la fonction SQL calendar_feed ne renvoie que ses
// entretiens, appels et dates limites (supabase/migrations/20261126000000_fichiers_agenda.sql).

type FeedData = {
  timeZone: string | null;
  interactions: Record<string, unknown>[];
  applications: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
};

const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const camel = <T>(row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([k, v]) => [toCamel(k), v])) as T;

/** Date du jour (`YYYY-MM-DD`) dans le fuseau de la personne. */
function todayIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function handleCalendarFeed(token: string, request: Request, env: Env, now = new Date()): Promise<Response> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/calendar_feed`, {
    method: "POST",
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ feed_token: token }),
  });
  if (!res.ok) return new Response("Agenda momentanément indisponible", { status: 502 });
  const data = (await res.json()) as FeedData | null;
  if (!data) return new Response("Abonnement introuvable : le lien a peut-être été régénéré.", { status: 404 });

  const timeZone = data.timeZone || "Europe/Paris";
  const events = icsEventsFrom(
    {
      interactions: data.interactions.map((r) => camel<FeedInteraction>(r)),
      applications: data.applications.map((r) => camel<FeedApplication>(r)),
      contacts: data.contacts.map((r) => camel<FeedContact>(r)),
    },
    new URL(request.url).origin,
    todayIn(timeZone, now),
  );
  return new Response(buildCalendar(events, { name: "Stage Tracker", now, refreshMinutes: 60, timeZone }), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
