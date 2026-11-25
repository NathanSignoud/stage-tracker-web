import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { CompanyMark } from "@/components/company-mark";
import { Tile } from "@/components/dashboard/tile";
import { MessageButton } from "@/components/messages/message-button";
import { Button } from "@/components/ui/button";
import { daysBetween, relativeDay } from "@/lib/dates";
import type { Dashboard } from "@/services/dashboard";

const MAX_ROWS = 4;

/** Candidatures sans nouvelles (avec « Relancer » direct) et dates limites proches. */
export function WatchTile({
  stale,
  deadlines,
  today,
  className,
}: {
  stale: Dashboard["stale"];
  deadlines: Dashboard["deadlines"];
  today: string;
  className?: string;
}) {
  const rows = [
    ...deadlines.map((a) => ({ kind: "deadline" as const, a })),
    ...stale.map((a) => ({ kind: "stale" as const, a })),
  ];
  const hidden = rows.length - MAX_ROWS;

  return (
    <Tile
      tone="stale"
      title="À surveiller"
      count={rows.length}
      className={className}
      action={
        hidden > 0 && (
          <Link to="/candidatures?vue=tableau" className="flex items-center gap-1 hover:underline">
            {hidden} de plus <ArrowRight className="size-3.5" />
          </Link>
        )
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-tile-stale-ink">Aucune candidature oubliée, aucune date limite proche.</p>
      ) : (
        <ul className="-my-1">
          {rows.slice(0, MAX_ROWS).map(({ kind, a }) => (
            <li key={`${kind}${a.id}`} className="flex items-center gap-3 py-1.5">
              <CompanyMark name={a.company} />
              <Link to={`/candidatures/${a.id}`} className="min-w-0 flex-1 hover:underline">
                <span className="block truncate font-semibold">{a.company}</span>
                <span className="block truncate text-xs text-tile-stale-ink">
                  {kind === "deadline"
                    ? `Date limite ${relativeDay(a.deadline!, today)}`
                    : a.lastActivity
                      ? `Sans nouvelles depuis ${daysBetween(a.lastActivity, today)} jours`
                      : "Sans nouvelles"}
                </span>
              </Link>
              {kind === "stale" ? (
                <MessageButton compact label="Relancer" applicationId={a.id} />
              ) : (
                <Button size="xs" variant="outline" className="border-transparent bg-card" asChild>
                  <Link to={`/candidatures/${a.id}`}>Postuler</Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}
