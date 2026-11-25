import { ArrowRight, CalendarPlus, GraduationCap } from "lucide-react";
import { Link } from "react-router";
import { Tile } from "@/components/dashboard/tile";
import { downloadIcs } from "@/components/interviews/schedule-interview-dialog";
import { useUi } from "@/components/ui-state";
import { Button } from "@/components/ui/button";
import { daysBetween, formatDay } from "@/lib/dates";
import { INTERACTION_LABELS, INTERVIEW_KIND_LABELS } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import type { Dashboard } from "@/services/dashboard";

function Countdown({ days }: { days: number }) {
  const label = days === 0 ? "C'est aujourd'hui" : days === 1 ? "C'est demain" : `Dans ${days} jours`;
  return (
    <div
      role="img"
      aria-label={label}
      className="grid size-28 shrink-0 place-content-center rounded-full bg-background/60 text-center sm:size-32"
    >
      {days === 0 ? (
        <span className="font-heading text-xl font-bold">Jour J</span>
      ) : (
        <>
          <span className="font-heading text-4xl leading-none font-bold sm:text-5xl">{days}</span>
          <span className="mt-1 text-sm font-semibold">{days === 1 ? "jour" : "jours"}</span>
        </>
      )}
    </div>
  );
}

/** Bloc « héros » : le prochain entretien et son compte à rebours, puis ce qu'il reste à planifier. */
export function NextInterviewCard({
  next,
  toSchedule,
  upcomingCount,
  today,
  className,
}: {
  next: Dashboard["nextInterview"];
  toSchedule: Dashboard["toSchedule"];
  upcomingCount: number;
  today: string;
  className?: string;
}) {
  const { setScheduleTarget } = useUi();
  const label = next ? (next.type === "interview" ? INTERVIEW_KIND_LABELS[next.interviewKind ?? "other"] : INTERACTION_LABELS[next.type]) : "";
  const where = next && [next.location, next.contactName && `avec ${next.contactName}`].filter(Boolean).join(", ");

  return (
    <Tile
      tone="interview"
      className={className}
      title={next && next.type !== "interview" ? "Ton prochain rendez-vous" : "Ton prochain entretien"}
      action={
        upcomingCount > 1 && (
          <Link to="/calendrier" className="flex items-center gap-1 hover:underline">
            {upcomingCount - 1} autre{upcomingCount > 2 ? "s" : ""} à venir <ArrowRight className="size-3.5" />
          </Link>
        )
      }
    >
      {next ? (
        <div className="flex flex-wrap items-center gap-6">
          <div className="min-w-0 flex-[1_1_260px]">
            <p className="font-heading text-4xl leading-[0.95] font-bold tracking-tight break-words sm:text-5xl">
              {next.company ?? next.contactName ?? next.summary}
            </p>
            <p className="mt-3 text-base font-medium">
              {label}, {formatDay(next.date, "EEEE d MMMM")} à {next.date.slice(11, 16)}
              {next.durationMinutes && `, ${next.durationMinutes} min`}
            </p>
            {where && <p className="mt-1 text-sm text-tile-interview-ink">{where}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {next.applicationId && (
                <Button asChild>
                  <Link to={`/candidatures/${next.applicationId}/preparation`}>
                    <GraduationCap /> Préparer l&apos;entretien
                  </Link>
                </Button>
              )}
              <Button variant="outline" className="border-transparent bg-card" onClick={() => downloadIcs(next.id)}>
                <CalendarPlus /> Ajouter à mon agenda
              </Button>
              {next.applicationId && (
                <Button variant="ghost" asChild>
                  <Link to={`/candidatures/${next.applicationId}`}>
                    Voir la fiche <ArrowRight />
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <Countdown days={daysBetween(today, next.date)} />
        </div>
      ) : (
        <div>
          <p className="font-heading text-2xl font-bold tracking-tight">Aucun entretien prévu</p>
          <p className="mt-2 max-w-prose text-sm text-tile-interview-ink">
            Quand une candidature passe en entretien, l&apos;app te demande sa date : il apparaîtra ici avec un compte à rebours.
          </p>
        </div>
      )}

      {toSchedule.length > 0 && (
        <div className={cn("rounded-2xl bg-background/60 p-3", !next && "mt-1")}>
          <p className="px-1 text-sm font-semibold">Date à fixer</p>
          <ul className="mt-1">
            {toSchedule.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                <Link to={`/candidatures/${a.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
                  <span className="font-semibold">{a.company}</span>
                  <span className="text-tile-interview-ink">, {INTERVIEW_KIND_LABELS[a.kind].toLowerCase()}</span>
                </Link>
                <Button size="sm" variant="outline" className="border-transparent bg-card" onClick={() => setScheduleTarget({ applicationId: a.id, company: a.company, kind: a.kind })}>
                  Fixer la date
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Tile>
  );
}
