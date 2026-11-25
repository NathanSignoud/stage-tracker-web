import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { Tile } from "@/components/dashboard/tile";
import { STATUS_STYLES } from "@/components/status";
import { OPEN_STATUSES, STATUS_LABELS, type Status } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

/** Répartition des candidatures en cours par étape : une barre segmentée + une pastille cliquable par étape. */
export function PipelineStrip({
  counts,
  closed,
  className,
}: {
  counts: Record<Status, number>;
  closed: { accepted: number; rejected: number; abandoned: number };
  className?: string;
}) {
  const total = OPEN_STATUSES.reduce((n, s) => n + (counts[s] ?? 0), 0);
  const closedTotal = closed.accepted + closed.rejected + closed.abandoned;

  return (
    <Tile
      title={`Tes ${total} candidature${total > 1 ? "s" : ""} en cours`}
      className={className}
      action={
        <Link to="/candidatures" className="flex items-center gap-1 hover:underline">
          Ouvrir le Kanban <ArrowRight className="size-3.5" />
        </Link>
      }
    >
      {total > 0 && (
        <div
          role="img"
          aria-label={OPEN_STATUSES.map((s) => `${STATUS_LABELS[s]} : ${counts[s] ?? 0}`).join(", ")}
          className="flex h-4 gap-1"
        >
          {OPEN_STATUSES.filter((s) => counts[s]).map((s) => (
            <span key={s} className={cn("min-w-2 rounded-md", STATUS_STYLES[s].dot)} style={{ flexGrow: counts[s] }} />
          ))}
        </div>
      )}
      <ul className="flex flex-wrap gap-2">
        {OPEN_STATUSES.map((s) => {
          const n = counts[s] ?? 0;
          return (
            <li key={s}>
              <Link
                to={`/candidatures?vue=tableau&statut=${s}`}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-full bg-muted px-3.5 text-[13px] transition-colors hover:bg-accent",
                  !n && "text-muted-foreground",
                )}
              >
                <span className={cn("size-2.5 rounded-full", STATUS_STYLES[s].dot, !n && "opacity-40")} aria-hidden="true" />
                {STATUS_LABELS[s]}
                <span className="font-semibold tabular-nums">{n}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {closedTotal > 0 && (
        <p className="text-[13px] text-muted-foreground">
          Clôturées : {closed.accepted} acceptée{closed.accepted > 1 ? "s" : ""}, {closed.rejected} refusée{closed.rejected > 1 ? "s" : ""},{" "}
          {closed.abandoned} abandonnée{closed.abandoned > 1 ? "s" : ""}.
        </p>
      )}
    </Tile>
  );
}
