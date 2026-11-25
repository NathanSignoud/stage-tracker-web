import { cn } from "@/lib/utils";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Priority,
  type Status,
} from "@/lib/domain/constants";

export const STATUS_STYLES: Record<Status, { dot: string; badge: string }> = {
  to_explore: { dot: "bg-zinc-400", badge: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300" },
  to_apply: { dot: "bg-violet-400", badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  sent: { dot: "bg-sky-400", badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  followed_up: { dot: "bg-cyan-400", badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
  hr_interview: { dot: "bg-amber-400", badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  tech_test: { dot: "bg-pink-400", badge: "bg-pink-500/15 text-pink-700 dark:text-pink-300" },
  tech_interview: { dot: "bg-orange-400", badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  offer: { dot: "bg-emerald-400", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  accepted: { dot: "bg-green-500", badge: "bg-green-500/20 text-green-700 dark:text-green-300" },
  rejected: { dot: "bg-rose-400", badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  abandoned: { dot: "bg-zinc-600", badge: "bg-zinc-500/10 text-zinc-500" },
};

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", STATUS_STYLES[status].dot, className)} />;
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status].badge,
        className,
      )}
    >
      <StatusDot status={status} className="size-1.5" />
      {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLES: Record<Priority, string> = {
  1: "text-rose-600 dark:text-rose-400",
  2: "text-amber-600 dark:text-amber-400",
  3: "text-muted-foreground",
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      title={`Priorité ${PRIORITY_LABELS[priority].toLowerCase()}`}
      className={cn("font-mono text-xs font-semibold", PRIORITY_STYLES[priority], className)}
    >
      P{priority}
    </span>
  );
}
