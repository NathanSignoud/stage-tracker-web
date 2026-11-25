import { CalendarClock, CalendarPlus, MapPin } from "lucide-react";
import { Panel } from "@/components/page-header";
import { useUi } from "@/components/ui-state";
import { downloadIcs } from "@/components/interviews/schedule-interview-dialog";
import { Button } from "@/components/ui/button";
import { formatDay, relativeDay } from "@/lib/dates";
import { INTERACTION_LABELS, INTERVIEW_KIND_LABELS, type InterviewKind } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import type { TimelineInteraction } from "@/components/interactions/timeline";

/** Entretiens et appels d'une candidature, avec export agenda et rappel s'il manque une date. */
export function InterviewsPanel({
  application,
  interviews,
  pendingKind,
  defaultKind,
  now,
}: {
  application: { id: number; company: string };
  interviews: TimelineInteraction[];
  /** Type d'entretien attendu mais pas encore daté, le cas échéant. */
  pendingKind: InterviewKind | null;
  defaultKind: InterviewKind;
  now: string;
}) {
  const { setScheduleTarget } = useUi();
  const today = now.slice(0, 10);
  const schedule = (kind: InterviewKind) => setScheduleTarget({ applicationId: application.id, company: application.company, kind });

  return (
    <Panel
      tone="interview"
      title="Entretiens"
      count={interviews.length}
      actions={
        <Button variant="ghost" size="sm" onClick={() => schedule(pendingKind ?? defaultKind)}>
          <CalendarPlus /> Planifier
        </Button>
      }
    >
      {pendingKind && (
        <div className="my-1.5 flex flex-wrap items-center gap-2 rounded-2xl bg-background/60 px-3 py-2 text-[13px]">
          <CalendarClock className="size-4 text-tile-interview-ink" />
          <span className="flex-1">{INTERVIEW_KIND_LABELS[pendingKind]} : pas encore de date.</span>
          <Button size="xs" onClick={() => schedule(pendingKind)}>
            Fixer la date
          </Button>
        </div>
      )}
      {interviews.length === 0 && !pendingKind && (
        <p className="py-2 text-[13px] text-muted-foreground">Aucun entretien planifié.</p>
      )}
      <ul className="divide-y">
        {interviews.map((i) => {
          const past = i.date < now;
          const label = i.type === "interview" ? INTERVIEW_KIND_LABELS[i.interviewKind ?? "other"] : INTERACTION_LABELS[i.type];
          return (
            <li key={i.id} className={cn("flex items-center gap-3 py-2", past && "opacity-60")}>
              <div className="grid w-12 shrink-0 place-items-center rounded-xl bg-background/60 py-1 leading-tight">
                <span className="text-[10px] text-muted-foreground uppercase">{formatDay(i.date, "MMM")}</span>
                <span className="text-base font-semibold">{formatDay(i.date, "d")}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {past ? "passé" : relativeDay(i.date, today)}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDay(i.date, "EEEE")} à {i.date.slice(11, 16)}
                  {i.durationMinutes && ` · ${i.durationMinutes} min`}
                  {i.contactName && ` · ${i.contactName}`}
                </p>
                {i.location && (
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" /> {i.location}
                  </p>
                )}
              </div>
              {!past && (
                <Button variant="outline" size="xs" onClick={() => downloadIcs(i.id)} title="Télécharger le .ics pour Outlook / Apple Calendrier">
                  <CalendarPlus /> Agenda
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
