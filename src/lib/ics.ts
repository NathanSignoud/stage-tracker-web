// Génération de fichiers iCalendar (RFC 5545), lus par Apple Calendrier, Outlook, Google Agenda.
// Les heures sont converties en UTC (suffixe Z) : aucun fuseau (VTIMEZONE) à déclarer, et chaque
// application les réaffiche dans le fuseau de l'appareil.

export type IcsEvent = {
  uid: string;
  /** `YYYY-MM-DDTHH:mm` (heure locale du PC) ou `YYYY-MM-DD` pour un événement « journée entière ». */
  start: string;
  allDay?: boolean;
  durationMinutes?: number;
  title: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  /** À incrémenter à chaque modification, pour que les agendas acceptent la mise à jour. */
  sequence?: number;
  /** Rappels, en minutes avant le début. */
  alarms?: number[];
};

const pad = (n: number) => String(n).padStart(2, "0");

function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function dateValue(day: string): string {
  return day.slice(0, 10).replaceAll("-", "");
}

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Replie une ligne à 75 octets (UTF-8) sans couper un caractère ; suite = espace en tête. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74; // l'espace de continuation compte dans les 75 octets
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function eventLines(event: IcsEvent, now: Date): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${event.uid}`, `DTSTAMP:${utcStamp(now)}`];
  if (event.allDay) {
    const day = event.start.slice(0, 10);
    lines.push(`DTSTART;VALUE=DATE:${dateValue(day)}`, `DTEND;VALUE=DATE:${dateValue(nextDay(day))}`, "TRANSP:TRANSPARENT");
  } else {
    // `YYYY-MM-DDTHH:mm` sans fuseau est interprété en heure locale par Date.
    const start = new Date(event.start);
    const end = new Date(start.getTime() + (event.durationMinutes ?? 60) * 60_000);
    lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`, "TRANSP:OPAQUE");
  }
  lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push(`SEQUENCE:${event.sequence ?? 0}`, "STATUS:CONFIRMED");
  for (const minutes of event.alarms ?? []) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.title)}`,
      `TRIGGER:-PT${minutes}M`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT");
  return lines;
}

export function buildCalendar(
  events: IcsEvent[],
  options: { name: string; now?: Date; refreshMinutes?: number } = { name: "Stage Tracker" },
): string {
  const now = options.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stage Tracker//Suivi de candidatures//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.name)}`,
  ];
  if (options.refreshMinutes) {
    lines.push(
      `REFRESH-INTERVAL;VALUE=DURATION:PT${options.refreshMinutes}M`,
      `X-PUBLISHED-TTL:PT${options.refreshMinutes}M`,
    );
  }
  for (const event of events) lines.push(...eventLines(event, now));
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Numéro de version croissant tiré de `updated_at` (secondes depuis 2024). */
export function sequenceFrom(updatedAtIso: string): number {
  return Math.max(0, Math.floor((Date.parse(updatedAtIso) - Date.UTC(2024, 0, 1)) / 1000));
}
