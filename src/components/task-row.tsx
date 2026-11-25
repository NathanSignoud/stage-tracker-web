import { CalendarClock, MoreHorizontal, Send, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-button";
import { MessageButton } from "@/components/messages/message-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAction } from "@/components/use-action";
import { relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { markFollowedUpAction } from "@/actions/applications";
import { moveToTrashAction, postponeTaskAction, setTaskDoneAction } from "@/actions/records";
import type { Task } from "@/lib/types";

export function DueLabel({ dueDate, today, done }: { dueDate: string | null; today: string; done?: boolean }) {
  if (!dueDate) return null;
  return (
    <span
      className={cn(
        "shrink-0 text-xs tabular-nums text-muted-foreground",
        !done && dueDate < today && "text-rose-700 dark:text-rose-400",
        !done && dueDate === today && "text-amber-800 dark:text-amber-400",
      )}
    >
      {relativeDay(dueDate, today)}
    </span>
  );
}

export function TaskRow({
  task,
  company,
  today,
  showCompany = true,
}: {
  task: Pick<Task, "id" | "title" | "dueDate" | "doneAt" | "cancelledAt" | "origin" | "applicationId">;
  company?: string | null;
  today: string;
  showCompany?: boolean;
}) {
  const { pending, run } = useAction();
  const [confirmTrash, setConfirmTrash] = useState(false);
  const closed = Boolean(task.doneAt || task.cancelledAt);
  const isFollowUp = task.origin === "auto_followup" && !closed && task.applicationId;

  return (
    <div className={cn("group flex min-h-9 flex-wrap items-center gap-x-2.5 gap-y-1 py-1.5", pending && "opacity-60")}>
      <Checkbox
        checked={Boolean(task.doneAt)}
        disabled={pending}
        aria-label="Marquer comme faite"
        onCheckedChange={(checked) => run(() => setTaskDoneAction(task.id, checked === true))}
      />
      {/* basis : sous ~11rem le titre passe seul sur sa ligne et les actions vont dessous, plutôt que d'être écrasé. */}
      <div className="min-w-0 flex-[1_1_11rem]">
        <p className={cn("truncate", closed && "text-muted-foreground line-through")}>
          {task.title}
          {task.cancelledAt && <span className="ml-1.5 text-xs no-underline">(annulée)</span>}
        </p>
        {showCompany && company && task.applicationId && (
          <Link to={`/candidatures/${task.applicationId}`} className="text-xs text-muted-foreground hover:underline">
            {company}
          </Link>
        )}
      </div>
      {/* Date + actions passent à la ligne d'un bloc, calées à droite. */}
      <div className="ml-auto flex items-center gap-2">
        <DueLabel dueDate={task.dueDate} today={today} done={closed} />
        {!closed && task.applicationId && (task.origin === "thank_you" || task.origin === "auto_followup") && (
          <MessageButton compact applicationId={task.applicationId} templateKey={task.origin === "thank_you" ? "thank_you" : undefined} />
        )}
        {isFollowUp && (
          <Button
            size="xs"
            variant="outline"
            disabled={pending}
            title="J'ai relancé : passe la candidature en « Relancée » et planifie la suivante"
            onClick={() => run(() => markFollowedUpAction(task.applicationId!), { success: "Relance notée" })}
          >
            <Send /> Relancé
          </Button>
        )}
        {!closed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Actions" className="opacity-60 group-hover:opacity-100">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {[1, 3, 7].map((days) => (
                <DropdownMenuItem key={days} onSelect={() => run(() => postponeTaskAction(task.id, days))}>
                  <CalendarClock /> Reporter de {days} jour{days > 1 ? "s" : ""}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmTrash(true)}>
                <Trash2 /> Mettre à la corbeille
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <ConfirmDialog
        open={confirmTrash}
        onOpenChange={setConfirmTrash}
        title="Mettre cette tâche à la corbeille ?"
        description={task.title}
        confirmLabel="Mettre à la corbeille"
        destructive
        onConfirm={() => run(() => moveToTrashAction("task", task.id), { success: "Tâche mise à la corbeille" })}
      />
    </div>
  );
}
