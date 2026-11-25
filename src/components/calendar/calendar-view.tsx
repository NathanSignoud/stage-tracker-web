import { MapPin } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { EVENT_KIND_META, EVENT_KINDS, EventChip, EventKindDot, eventText } from "@/components/calendar/event-chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, daysBetween, formatDay } from "@/lib/dates";
import { capitalizeFirst } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarEventKind } from "@/services/calendar";

const WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const MAX_PER_CELL = 3;

export function CalendarView({
  month,
  today,
  gridStart,
  gridEnd,
  events,
}: {
  /** `YYYY-MM` */
  month: string;
  today: string;
  gridStart: string;
  gridEnd: string;
  events: CalendarEvent[];
}) {
  const [shown, setShown] = useState<CalendarEventKind[]>(EVENT_KINDS);
  const visible = events.filter((e) => shown.includes(e.kind));
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of visible) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const days = Array.from({ length: daysBetween(gridStart, gridEnd) + 1 }, (_, i) => addDays(gridStart, i));
  const monthDays = days.filter((d) => d.startsWith(month));

  return (
    <div className="grid gap-3">
      {/* Filtres = légende : chaque type porte sa couleur et son libellé. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Types d'événements affichés">
        {EVENT_KINDS.map((kind) => {
          const on = shown.includes(kind);
          const count = events.filter((e) => e.kind === kind && e.date.startsWith(month)).length;
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={on}
              onClick={() => setShown(on ? shown.filter((k) => k !== kind) : [...shown, kind])}
              className={cn(
                "flex h-9 items-center gap-2 rounded-full bg-card px-3.5 text-[13px] ring-1 ring-border transition-colors",
                on ? "bg-card" : "text-muted-foreground opacity-60",
              )}
            >
              <EventKindDot kind={kind} className={cn(!on && "opacity-40")} />
              {EVENT_KIND_META[kind].label}
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Grille mensuelle (écrans moyens et plus). */}
      <div className="hidden overflow-hidden rounded-3xl bg-card ring-1 ring-border md:block">
        <div className="grid grid-cols-7 border-b text-xs text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-1.5">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const items = byDay.get(day) ?? [];
            const inMonth = day.startsWith(month);
            const isToday = day === today;
            return (
              <div
                key={day}
                className={cn(
                  "min-h-28 min-w-0 border-b p-1.5",
                  i % 7 !== 6 && "border-r",
                  !inMonth && "bg-muted/25",
                  day < today && "text-muted-foreground",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-full text-xs",
                      !inMonth && "text-muted-foreground/60",
                      isToday && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                </div>
                <div className="grid gap-0.5">
                  {items.slice(0, MAX_PER_CELL).map((e) => (
                    <EventChip key={e.key} event={e} className={cn(day < today && "opacity-70")} />
                  ))}
                  {items.length > MAX_PER_CELL && (
                    <Popover>
                      <PopoverTrigger className="rounded px-1.5 text-left text-[11px] text-muted-foreground hover:bg-muted">
                        +{items.length - MAX_PER_CELL} autre{items.length - MAX_PER_CELL > 1 ? "s" : ""}
                      </PopoverTrigger>
                      <PopoverContent className="grid w-64 gap-1 p-2">
                        <p className="px-1 text-xs font-medium">{formatDay(day, "EEEE d MMMM")}</p>
                        {items.map((e) => (
                          <EventChip key={e.key} event={e} />
                        ))}
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda (téléphone) : uniquement les jours qui ont des événements. */}
      <div className="grid gap-3 md:hidden">
        {monthDays.filter((d) => byDay.has(d) || d === today).length === 0 && (
          <p className="py-8 text-center text-[13px] text-muted-foreground">Rien ce mois-ci.</p>
        )}
        {monthDays
          .filter((d) => byDay.has(d) || d === today)
          .map((day) => (
            <section key={day} className={cn("overflow-hidden rounded-3xl bg-card ring-1 ring-border", day === today && "ring-2 ring-primary/40")}>
              <h3 className="border-b px-4 py-2.5 text-sm font-semibold">
                {capitalizeFirst(formatDay(day, "EEEE d MMMM"))}
                {day === today && <span className="ml-2 text-muted-foreground">· aujourd&apos;hui</span>}
              </h3>
              <ul className="divide-y">
                {(byDay.get(day) ?? []).map((e) => (
                  <AgendaRow key={e.key} event={e} />
                ))}
                {!byDay.has(day) && <li className="px-3 py-2 text-[13px] text-muted-foreground">Rien de prévu.</li>}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}

function AgendaRow({ event }: { event: CalendarEvent }) {
  const { primary, secondary } = eventText(event);
  const body = (
    <div className="flex items-start gap-3 px-3 py-2">
      <span className="w-11 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">{event.time ?? "—"}</span>
      <EventKindDot kind={event.kind} className="mt-1.5" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{primary}</p>
        <p className="truncate text-xs text-muted-foreground">
          {secondary}
          {event.durationMinutes && ` · ${event.durationMinutes} min`}
        </p>
        {event.location && (
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" /> {event.location}
          </p>
        )}
      </div>
    </div>
  );
  return <li>{event.applicationId ? <Link to={`/candidatures/${event.applicationId}`}>{body}</Link> : body}</li>;
}
