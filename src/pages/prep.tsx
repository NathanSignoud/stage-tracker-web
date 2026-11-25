import { ArrowLeft, CalendarClock, MapPin } from "lucide-react";
import { Link, useParams } from "react-router";
import { NotFound } from "@/pages/coming-soon";
import { PageHeader } from "@/components/page-header";
import { PrepBoard } from "@/components/prep/prep-board";
import { PromptButton } from "@/components/prompts/prompt-button";
import { PageLoading } from "@/components/page-loading";
import { useData } from "@/lib/data";
import { formatDayTime, localDate, localDateTime, relativeDay } from "@/lib/dates";
import { INTERVIEW_KIND_LABELS } from "@/lib/domain/constants";
import { getApplicationDetail } from "@/services/applications";
import { getPrep } from "@/services/prep";

async function load(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const detail = await getApplicationDetail(id);
  if (!detail || detail.application.deletedAt) return null;
  return { detail, prep: await getPrep(id) };
}

export function PrepPage() {
  const id = Number(useParams().id);
  const { data, error } = useData(() => load(id), [id]);
  if (data === undefined) return <PageLoading error={error} />;
  if (data === null) return <NotFound />;
  const { detail, prep } = data;
  const app = detail.application;
  const now = localDateTime();
  const next = detail.interactions
    .filter((i) => i.type === "interview" && i.date > now)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <div className="mx-auto max-w-6xl">
      <title>{`Préparation · ${app.company} · Stage Tracker`}</title>
      <Link to={`/candidatures/${id}`} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> {app.company}
      </Link>
      <PageHeader
        title={`Préparer l'entretien · ${app.company}`}
        description={
          next ? (
            <span className="flex flex-wrap items-center gap-x-3">
              <span className="flex items-center gap-1">
                <CalendarClock className="size-3.5" />
                {INTERVIEW_KIND_LABELS[next.interviewKind ?? "other"]} · {formatDayTime(next.date)} ({relativeDay(next.date, localDate())})
              </span>
              {next.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> {next.location}
                </span>
              )}
            </span>
          ) : (
            "Aucun entretien planifié pour l'instant."
          )
        }
        actions={<PromptButton applicationId={id} variant="interview_prep" />}
      />
      <PrepBoard applicationId={id} notes={prep.notes} questions={prep.questions} />
    </div>
  );
}
