import {
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  Handshake,
  MessageCircle,
  Mail,
  MailOpen,
  MoreHorizontal,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-button";
import { InteractionDialog, type ContactOption } from "@/components/interactions/interaction-dialog";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAction } from "@/components/use-action";
import { formatDay, formatDayTime, localDateTime } from "@/lib/dates";
import { INTERACTION_LABELS, INTERVIEW_KIND_LABELS, type InteractionType } from "@/lib/domain/constants";
import { downloadIcs } from "@/components/interviews/schedule-interview-dialog";
import { cn } from "@/lib/utils";
import type { Interaction, StatusChange } from "@/lib/types";
import { moveToTrashAction } from "@/actions/records";

const ICONS: Record<InteractionType, React.ComponentType<{ className?: string }>> = {
  email_sent: Mail,
  email_received: MailOpen,
  call: Phone,
  interview: CalendarCheck,
  linkedin: MessageCircle,
  meeting: Handshake,
};

export type TimelineInteraction = Interaction & { contactName?: string | null; company?: string | null };

type Entry =
  | { kind: "interaction"; sortKey: string; item: TimelineInteraction }
  | { kind: "status"; sortKey: string; item: StatusChange };

/** Fil chronologique (plus récent en haut) : échanges + changements de statut. */
export function Timeline({
  interactions,
  history = [],
  contacts,
  now,
  showCompany = false,
}: {
  interactions: TimelineInteraction[];
  history?: StatusChange[];
  contacts: ContactOption[];
  /** Date-heure locale de référence (fournie par le serveur) pour repérer les échanges à venir. */
  now: string;
  showCompany?: boolean;
}) {
  const entries: Entry[] = [
    ...interactions.map((item) => ({ kind: "interaction" as const, sortKey: item.date, item })),
    // changed_at est un instant UTC : converti en heure locale pour être trié avec les échanges.
    ...history.map((item) => ({ kind: "status" as const, sortKey: localDateTime(new Date(item.changedAt)), item })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  if (!entries.length) return <p className="py-3 text-[13px] text-muted-foreground">Aucun échange pour l&apos;instant.</p>;

  return (
    <ol className="relative ml-2 border-l">
      {entries.map((e) =>
        e.kind === "status" ? (
          <li key={`s${e.item.id}`} className="relative flex items-center gap-2 py-1.5 pl-5 text-xs text-muted-foreground">
            <span className="absolute -left-[3px] size-1.5 rounded-full bg-border" />
            <ArrowRight className="size-3" />
            {e.item.fromStatus ? "Statut" : "Créée en"}
            <StatusBadge status={e.item.toStatus} />
            <span className="ml-auto tabular-nums">{formatDay(e.sortKey, "d MMM yyyy")}</span>
          </li>
        ) : (
          <InteractionEntry
            key={`i${e.item.id}`}
            interaction={e.item}
            upcoming={e.item.date > now}
            contacts={contacts}
            showCompany={showCompany}
          />
        ),
      )}
    </ol>
  );
}

function InteractionEntry({
  interaction: i,
  upcoming,
  contacts,
  showCompany,
}: {
  interaction: TimelineInteraction;
  upcoming: boolean;
  contacts: ContactOption[];
  showCompany: boolean;
}) {
  const { run } = useAction();
  const [editing, setEditing] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const Icon = ICONS[i.type];
  const typeLabel = i.type === "interview" && i.interviewKind ? INTERVIEW_KIND_LABELS[i.interviewKind] : INTERACTION_LABELS[i.type];
  const isMeeting = i.type === "interview" || i.type === "call" || i.type === "meeting";

  return (
    <li className="group relative py-2 pl-5">
      <span
        className={cn(
          "absolute top-2.5 -left-[11px] grid size-5 place-items-center rounded-full border bg-card",
          upcoming && "border-amber-500/60 text-amber-500",
        )}
      >
        <Icon className="size-3" />
      </span>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{i.summary}</p>
          <p className="text-xs text-muted-foreground">
            {typeLabel}
            {i.durationMinutes && ` · ${i.durationMinutes} min`}
            {i.contactName && ` · ${i.contactName}`}
            {showCompany && i.company && i.applicationId && (
              <>
                {" · "}
                <Link to={`/candidatures/${i.applicationId}`} className="hover:underline">
                  {i.company}
                </Link>
              </>
            )}
            {i.location && ` · ${i.location}`}
          </p>
        </div>
        <span className={cn("shrink-0 text-xs tabular-nums text-muted-foreground", upcoming && "text-amber-600 dark:text-amber-400")}>
          {upcoming && "À venir · "}
          {formatDayTime(i.date)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Actions" className="opacity-50 group-hover:opacity-100">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil /> Modifier
            </DropdownMenuItem>
            {isMeeting && (
              <DropdownMenuItem onSelect={() => downloadIcs(i.id)}>
                <CalendarPlus /> Ajouter à mon agenda (.ics)
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmTrash(true)}>
              <Trash2 /> Mettre à la corbeille
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {i.nextAction && (
        <p className="mt-1 text-xs">
          <span className="text-muted-foreground">Prochaine action :</span> {i.nextAction}
          {i.nextActionDate && <span className="text-muted-foreground"> · {formatDay(i.nextActionDate)}</span>}
        </p>
      )}
      {i.content && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Contenu</summary>
          <pre className="mt-1 max-h-80 overflow-auto rounded-md bg-muted/50 p-2.5 font-sans text-xs whitespace-pre-wrap">
            {i.content}
          </pre>
        </details>
      )}

      <InteractionDialog
        interaction={i}
        applicationId={i.applicationId}
        contacts={contacts}
        open={editing}
        onOpenChange={setEditing}
      />
      <ConfirmDialog
        open={confirmTrash}
        onOpenChange={setConfirmTrash}
        title="Mettre cet échange à la corbeille ?"
        description={i.summary}
        confirmLabel="Mettre à la corbeille"
        destructive
        onConfirm={() => run(() => moveToTrashAction("interaction", i.id), { success: "Échange mis à la corbeille" })}
      />
    </li>
  );
}
