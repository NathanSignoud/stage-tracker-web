import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Dashboard } from "@/services/dashboard";

// Rampe séquentielle (une teinte, clair → foncé) : 0 se fond dans la surface.
const LEVELS = ["bg-muted", "bg-viz-seq-1", "bg-viz-seq-2", "bg-viz-seq-3", "bg-viz-seq-4"];
const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4);
const ROW_LABELS = ["lun", "", "mer", "", "ven", "", "dim"];

/** Régularité : actions par jour (changements de statut + échanges) sur 12 semaines. */
export function ActivityHeatmap({ days, today, className }: { days: Dashboard["activity"]; today: string; className?: string }) {
  const total = days.reduce((n, d) => n + (d.count ?? 0), 0);
  const activeDays = days.filter((d) => d.count).length;
  return (
    <section className={cn("min-w-0 overflow-hidden rounded-3xl bg-card ring-1 ring-border", className)}>
      <header className="flex min-h-14 items-center px-5 pt-3 sm:px-6">
        <h2 className="text-[15px] font-semibold">Ton activité</h2>
        <span className="ml-2 text-[13px] text-muted-foreground">12 dernières semaines</span>
      </header>
      <div className="px-5 pb-5 sm:px-6">
        <div className="flex gap-1.5">
          <div className="grid grid-rows-7 gap-[3px] text-[9px] leading-none text-muted-foreground">
            {ROW_LABELS.map((l, i) => (
              <span key={i} className="flex h-3 items-center">
                {l}
              </span>
            ))}
          </div>
          <div
            className="grid grid-flow-col grid-rows-7 gap-[3px]"
            role="img"
            aria-label={`${total} actions sur 12 semaines, ${activeDays} jours actifs`}
          >
            {days.map((d) => (
              <span
                key={d.date}
                title={d.count === null ? undefined : `${formatDay(d.date, "EEE d MMM")} : ${d.count} action${d.count > 1 ? "s" : ""}`}
                className={cn(
                  "size-3 rounded-[3px]",
                  d.count === null ? "bg-transparent" : LEVELS[level(d.count)],
                  d.date === today && "ring-1 ring-foreground/60",
                )}
              />
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>
            <b className="text-foreground">{total}</b> actions · {activeDays} jours actifs
          </span>
          <span className="flex items-center gap-[3px]" aria-hidden>
            moins
            {LEVELS.map((c) => (
              <span key={c} className={cn("size-2.5 rounded-[2px]", c)} />
            ))}
            plus
          </span>
        </div>
      </div>
    </section>
  );
}
