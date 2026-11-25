import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { EVENT_KIND_META, EVENT_KINDS, EventChip, EventKindDot } from "@/components/calendar/event-chip";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Dashboard } from "@/services/dashboard";

/** Les 7 prochains jours : entretiens, dates limites et tâches, d'un coup d'œil. */
export function WeekStrip({ week, today, className }: { week: Dashboard["week"]; today: string; className?: string }) {
  const total = week.reduce((n, d) => n + d.events.length, 0);
  return (
    <section className={cn("min-w-0 overflow-hidden rounded-3xl bg-card ring-1 ring-border", className)}>
      <header className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 border-b px-5 py-3 sm:px-6">
        <h2 className="text-[15px] font-semibold">Les 7 prochains jours</h2>
        <span className="rounded-full bg-muted px-2 text-xs font-semibold tabular-nums">{total}</span>
        <ul className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-label="Légende">
          {EVENT_KINDS.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <EventKindDot kind={k} /> {EVENT_KIND_META[k].label}
            </li>
          ))}
        </ul>
        <Link to="/calendrier" className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          Calendrier <ArrowRight className="size-3" />
        </Link>
      </header>
      <ol className="flex overflow-x-auto lg:grid lg:grid-cols-7">
        {week.map(({ date, events }, i) => (
          <li key={date} className={cn("min-h-32 min-w-36 flex-1 p-2 lg:min-w-0", i > 0 && "border-l")}>
            <p className={cn("mb-1.5 flex items-baseline gap-1.5 px-0.5 text-xs", date === today ? "font-semibold" : "text-muted-foreground")}>
              <span className="capitalize">{formatDay(date, "EEE")}</span>
              <span className={cn("text-base leading-none", date === today ? "text-foreground" : "text-foreground/80")}>{formatDay(date, "d")}</span>
              {date === today && <span className="ml-auto rounded bg-primary px-1 text-[10px] font-medium text-primary-foreground">auj.</span>}
            </p>
            <div className="grid gap-1">
              {events.map((e) => (
                <EventChip key={e.key} event={e} stacked />
              ))}
              {events.length === 0 && <span className="px-0.5 text-xs text-muted-foreground/50">—</span>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
