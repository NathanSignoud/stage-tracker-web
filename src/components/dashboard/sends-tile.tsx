import { Tile } from "@/components/dashboard/tile";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Dashboard } from "@/services/dashboard";

/** Envois de la semaine face à l'objectif, avec les 8 dernières semaines en barres (la dernière = en cours). */
export function SendsTile({
  weeks,
  sentThisWeek,
  goal,
  className,
}: {
  weeks: Dashboard["weeklySent"];
  sentThisWeek: number;
  goal: number;
  className?: string;
}) {
  const max = Math.max(1, goal, ...weeks.map((w) => w.count));
  const left = Math.max(0, goal - sentThisWeek);
  const summary = weeks.map((w) => `semaine du ${formatDay(w.weekStart, "d MMMM")} : ${w.count}`).join(", ");

  return (
    <Tile tone="send" title="Envois cette semaine" className={className}>
      <div>
        <p className="font-heading text-4xl leading-none font-bold tracking-tight">
          {sentThisWeek}
          {goal > 0 && <span className="text-xl text-tile-send-ink"> / {goal}</span>}
        </p>
        <p className="mt-2 text-sm text-tile-send-ink">
          {goal === 0 ? "Fixe-toi un objectif dans Réglages." : left ? `Encore ${left} pour atteindre ton objectif.` : "Objectif atteint, bravo."}
        </p>
      </div>
      <div role="img" aria-label={`Candidatures envoyées par semaine : ${summary}. Objectif : ${goal}.`} className="mt-auto">
        <div className="relative flex h-24 items-end gap-1.5">
          {goal > 0 && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 border-t-2 border-dashed border-tile-send-ink/50"
              style={{ bottom: `${(goal / max) * 100}%` }}
            />
          )}
          {weeks.map((w, i) => (
            <span
              key={w.weekStart}
              className={cn("min-h-1 flex-1 rounded-md", i === weeks.length - 1 ? "bg-tile-send-ink" : "bg-tile-send-ink/35")}
              style={{ height: `${(w.count / max) * 100}%` }}
            />
          ))}
        </div>
        <div aria-hidden="true" className="mt-1.5 flex justify-between text-[11px] text-tile-send-ink">
          <span>{formatDay(weeks[0].weekStart, "d MMM")}</span>
          <span>cette semaine</span>
        </div>
      </div>
    </Tile>
  );
}
