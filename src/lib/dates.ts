import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

// Dates « calendrier » manipulées comme chaînes `YYYY-MM-DD` (comparables lexicographiquement).
// Les calculs de jours passent par UTC pour ne jamais être faussés par l'heure d'été.

const pad = (n: number) => String(n).padStart(2, "0");

/** Date locale du jour, `YYYY-MM-DD`. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date et heure locales, `YYYY-MM-DDTHH:mm` (format d'un `<input type="datetime-local">`). */
export function localDateTime(d: Date = new Date()): string {
  return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Date locale d'un instant ISO UTC (ex. `created_at`). */
export function isoToLocalDate(iso: string): string {
  return localDate(new Date(iso));
}

function toUtcMs(day: string): number {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  return new Date(toUtcMs(day) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Nombre de jours de `from` à `to` (positif si `to` est après). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000);
}

/** Lundi de la semaine contenant `day`. */
export function startOfWeek(day: string): string {
  const weekday = new Date(toUtcMs(day)).getUTCDay(); // 0 = dimanche
  return addDays(day, weekday === 0 ? -6 : 1 - weekday);
}

export function formatDay(day: string | null | undefined, pattern = "d MMM yyyy"): string {
  if (!day) return "";
  return format(parseISO(day.slice(0, 10)), pattern, { locale: fr });
}

export function formatDayTime(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 10) return formatDay(value);
  return format(parseISO(value), "d MMM yyyy 'à' HH:mm", { locale: fr });
}

/** « aujourd'hui », « demain », « il y a 3 j », « dans 5 j ». */
export function relativeDay(day: string, today: string): string {
  const diff = daysBetween(today, day);
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "demain";
  if (diff === -1) return "hier";
  return diff > 0 ? `dans ${diff} j` : `il y a ${-diff} j`;
}
