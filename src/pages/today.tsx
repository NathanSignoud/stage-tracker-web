import { ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { ActivityHeatmap } from "@/components/dashboard/activity-heatmap";
import { NextInterviewCard } from "@/components/dashboard/next-interview-card";
import { PipelineStrip } from "@/components/dashboard/pipeline-strip";
import { ResponseTile } from "@/components/dashboard/response-tile";
import { SendsTile } from "@/components/dashboard/sends-tile";
import { Tile } from "@/components/dashboard/tile";
import { WatchTile } from "@/components/dashboard/watch-tile";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { PageHeader } from "@/components/page-header";
import { TaskRow } from "@/components/task-row";
import { PageLoading } from "@/components/page-loading";
import { useData } from "@/lib/data";
import { formatDay } from "@/lib/dates";
import { capitalizeFirst } from "@/lib/text";
import { getDashboard } from "@/services/dashboard";
import { getSettings } from "@/services/settings";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
const MAX_TASKS = 5;

async function loadToday() {
  const [dashboard, settings] = await Promise.all([getDashboard(), getSettings()]);
  return { d: dashboard, firstName: settings.profile.fullName.trim().split(/\s+/)[0] };
}

export function TodayPage() {
  const { data, error } = useData(loadToday);
  if (!data) return <PageLoading error={error} />;
  const { d, firstName } = data;
  const tasks = [...d.followUpsDue, ...d.tasksDue];
  const interviewsThisWeek = d.week.reduce((n, day) => n + day.events.filter((e) => e.kind === "interview").length, 0);

  return (
    // grid-cols-1 = minmax(0, 1fr) : sinon la colonne prend la largeur minimale des blocs (520 px) et déborde sur téléphone.
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4">
      <title>Aujourd'hui · Stage Tracker</title>
      <PageHeader
        className="mb-1"
        title={firstName ? `Bonjour ${firstName}` : "Aujourd'hui"}
        description={
          <>
            {capitalizeFirst(formatDay(d.today, "EEEE d MMMM"))}.{" "}
            {tasks.length ? `${plural(tasks.length, "chose")} à faire` : "Rien en retard"},{" "}
            {interviewsThisWeek ? `${plural(interviewsThisWeek, "entretien")} cette semaine.` : "aucun entretien cette semaine."}
          </>
        }
      />

      {/* Ligne 1 : entretien + tâches ; ligne 2 : trois blocs égaux. Sous ~1050 px, chacun passe à la ligne. */}
      <div className="flex flex-wrap gap-4">
        <NextInterviewCard
          className="flex-[3_1_560px]"
          next={d.nextInterview}
          toSchedule={d.toSchedule}
          upcomingCount={d.upcomingAppointments.length}
          today={d.today}
        />

        <Tile
          tone="task"
          title="À faire aujourd'hui"
          count={tasks.length}
          className="flex-[2_1_440px]"
          action={
            <Link to="/taches" className="flex items-center gap-1 hover:underline">
              {tasks.length > MAX_TASKS ? `${tasks.length - MAX_TASKS} de plus` : "Toutes les tâches"} <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          {tasks.length === 0 ? (
            <div>
              <p className="font-heading text-2xl font-bold tracking-tight">Tout est à jour</p>
              <p className="mt-2 text-sm text-tile-task-ink">Aucune relance ni tâche en retard. Un bon moment pour envoyer une candidature.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5">
              {tasks.slice(0, MAX_TASKS).map((t) => (
                <div key={t.id} className="rounded-2xl bg-background/60 px-3">
                  <TaskRow task={t} company={t.company} today={d.today} />
                </div>
              ))}
            </div>
          )}
        </Tile>

        <SendsTile className="flex-[1_1_300px]" weeks={d.weeklySent} sentThisWeek={d.sentThisWeek} goal={d.weeklyGoal} />
        <WatchTile className="flex-[1_1_300px]" stale={d.stale} deadlines={d.deadlines} today={d.today} />
        <ResponseTile className="flex-[1_1_300px]" responses={d.responses} totals={d.totals} />
      </div>

      <WeekStrip week={d.week} today={d.today} />

      <div className="flex flex-wrap gap-4">
        <PipelineStrip className="flex-[2_1_520px]" counts={d.countsByStatus} closed={d.closedByStatus} />
        <ActivityHeatmap className="flex-[1_1_320px]" days={d.activity} today={d.today} />
      </div>
    </div>
  );
}
