import { Link } from "react-router";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarEventKind } from "@/services/calendar";

// Couleur = sujet (design Atelier) : violet entretiens, pêche dates limites, jaune tâches. Fond pastel +
// filet et pastille dans l'encre du sujet ; le type est toujours aussi écrit (légende, libellé).
export const EVENT_KINDS: CalendarEventKind[] = ["interview", "deadline", "task"];

export const EVENT_KIND_META: Record<CalendarEventKind, { label: string; dot: string; edge: string }> = {
  interview: { label: "Entretiens et appels", dot: "bg-tile-interview-ink", edge: "border-l-tile-interview-ink bg-tile-interview" },
  deadline: { label: "Dates limites", dot: "bg-tile-stale-ink", edge: "border-l-tile-stale-ink bg-tile-stale" },
  task: { label: "Tâches", dot: "bg-tile-task-ink", edge: "border-l-tile-task-ink bg-tile-task" },
};

export function EventKindDot({ kind, className }: { kind: CalendarEventKind; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", EVENT_KIND_META[kind].dot, className)} />;
}

/** Libellé court : « 14:30 Acme · Entretien RH », « Date limite · Mistral »… */
export function eventText(e: CalendarEvent): { primary: string; secondary: string } {
  if (e.kind === "interview") return { primary: e.company ?? e.contactName ?? e.title, secondary: e.title };
  if (e.kind === "deadline") return { primary: e.company ?? "", secondary: "Date limite" };
  return { primary: e.title, secondary: e.company ?? "" };
}

export function EventChip({
  event,
  stacked = false,
  className,
}: {
  event: CalendarEvent;
  /** Deux lignes (titre, puis heure + précision) : pour les colonnes étroites de la frise. */
  stacked?: boolean;
  className?: string;
}) {
  const { primary, secondary } = eventText(event);
  const content = stacked ? (
    <>
      <span className="truncate font-medium">{primary}</span>
      <span className="flex min-w-0 gap-1 text-muted-foreground">
        {event.time && <span className="shrink-0 font-mono text-[10px]">{event.time}</span>}
        <span className="truncate">{secondary}</span>
      </span>
    </>
  ) : (
    <>
      {event.time && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{event.time}</span>}
      <span className="truncate font-medium">{primary}</span>
      {secondary && <span className="hidden truncate text-muted-foreground xl:inline">{secondary}</span>}
    </>
  );
  const classes = cn(
    "flex min-w-0 rounded-md border-l-[3px] px-1.5 py-0.5 text-[11px] leading-4 transition-opacity hover:opacity-80",
    stacked ? "flex-col" : "items-center gap-1",
    EVENT_KIND_META[event.kind].edge,
    className,
  );
  const title = [event.time, primary, secondary, event.location].filter(Boolean).join(" · ");
  return event.applicationId ? (
    <Link to={`/candidatures/${event.applicationId}`} className={classes} title={title}>
      {content}
    </Link>
  ) : (
    <span className={classes} title={title}>
      {content}
    </span>
  );
}
