import { CalendarClock, Clock, MoreHorizontal } from "lucide-react";
import { Link } from "react-router";
import { PriorityBadge, StatusDot } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { relativeDay } from "@/lib/dates";
import { STATUS_LABELS, STATUSES, type Status } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import type { ApplicationListItem } from "@/services/applications";

export function ApplicationCard({
  item,
  today,
  onMove,
  compact = false,
  overlay = false,
}: {
  item: ApplicationListItem;
  today: string;
  /** Changement de statut via le menu (alternative au glisser-déposer, utile sur téléphone). */
  onMove?: (status: Status) => void;
  /** Une seule ligne : entreprise, priorité et alertes (sans nouvelles, tâche en retard). */
  compact?: boolean;
  overlay?: boolean;
}) {
  const overdue = !!item.nextDue && item.nextDue < today;
  return (
    <div
      className={cn(
        "group relative rounded-2xl bg-card ring-1 ring-border transition-shadow hover:shadow-sm hover:ring-foreground/20",
        overlay && "rotate-1 shadow-lg ring-1 ring-foreground/20",
      )}
    >
      {compact ? (
        <Link
          to={`/candidatures/${item.id}`}
          className="flex items-center gap-1.5 py-1.5 pr-7 pl-2.5"
          draggable={false}
          title={[item.company, item.title].filter(Boolean).join(" — ")}
        >
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.company}</p>
          {item.stale && <Clock className="size-3 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Sans nouvelles" />}
          {overdue && <CalendarClock className="size-3 shrink-0 text-rose-600 dark:text-rose-400" aria-label="Tâche en retard" />}
          <PriorityBadge priority={item.priority} className="text-[11px]" />
        </Link>
      ) : (
        <Link to={`/candidatures/${item.id}`} className="block p-2.5" draggable={false}>
          <div className="flex items-start gap-2 pr-5">
            <p className="min-w-0 flex-1 truncate font-medium">{item.company}</p>
            <PriorityBadge priority={item.priority} />
          </div>
          {item.title && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.title}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground empty:hidden">
            {item.matchScore != null && (
              <span className="font-mono" title="Score de matching">
                {Math.round(item.matchScore * 100)}%
              </span>
            )}
            {item.tags.slice(0, 2).map((t) => (
              <span key={t} className="rounded-full bg-muted px-2 py-px">
                {t}
              </span>
            ))}
            {item.stale && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400" title="Sans nouvelles">
                <Clock className="size-3" />
                {item.lastActivity && relativeDay(item.lastActivity, today)}
              </span>
            )}
            {item.nextDue && (
              <span className={cn("flex items-center gap-1", overdue && "text-rose-600 dark:text-rose-400")} title="Prochaine tâche">
                <CalendarClock className="size-3" />
                {relativeDay(item.nextDue, today)}
              </span>
            )}
          </div>
        </Link>
      )}
      {onMove && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Déplacer"
              className={cn("absolute right-1 opacity-50 group-hover:opacity-100", compact ? "top-1" : "top-1.5")}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Déplacer vers</DropdownMenuLabel>
            {STATUSES.filter((s) => s !== item.status).map((s) => (
              <DropdownMenuItem key={s} onSelect={() => onMove(s)}>
                <StatusDot status={s} /> {STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
