import { ArrowLeft, ExternalLink, MessageSquarePlus, Pencil } from "lucide-react";
import { Link, useParams } from "react-router";
import { EditApplicationButton } from "@/components/applications/application-form";
import { ContactsPanelActions, LinkedContactsList } from "@/components/applications/contacts-panel";
import { StatusSelect } from "@/components/applications/status-select";
import { CompanyMark } from "@/components/company-mark";
import { InteractionDialog } from "@/components/interactions/interaction-dialog";
import { Timeline } from "@/components/interactions/timeline";
import { InterviewsPanel } from "@/components/interviews/interviews-panel";
import { OfferAnalysis } from "@/components/offer/offer-analysis";
import { Panel } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { PriorityBadge } from "@/components/status";
import { TaskRow } from "@/components/task-row";
import { AddTaskForm } from "@/components/tasks/add-task-form";
import { RestoreBanner, TrashButton } from "@/components/trash-buttons";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/data";
import { formatDay, localDate, localDateTime } from "@/lib/dates";
import { REMOTE_LABELS, SOURCE_LABELS, STATUS_INTERVIEW_KINDS } from "@/lib/domain/constants";
import { highlightSegments } from "@/lib/domain/matching";
import { NotFound } from "@/pages/coming-soon";
import { getApplicationDetail, listTagNames } from "@/services/applications";
import { interviewsToSchedule } from "@/services/calendar";
import { listContacts } from "@/services/contacts";
import { analyzeOffer } from "@/services/keywords";

async function loadApplication(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  const detail = await getApplicationDetail(id);
  if (!detail) return null;
  const [allContacts, pending, match, tagSuggestions] = await Promise.all([
    listContacts(),
    interviewsToSchedule(),
    analyzeOffer(detail.application.offerText),
    listTagNames(),
  ]);
  return { detail, allContacts, pendingKind: pending.find((a) => a.id === id)?.kind ?? null, match, tagSuggestions };
}

export function ApplicationPage() {
  const id = Number(useParams().id);
  const { data, error } = useData(() => loadApplication(id), [id]);
  if (data === undefined) return <PageLoading error={error} />;
  if (data === null) return <NotFound />;

  const { detail, allContacts, pendingKind, match, tagSuggestions } = data;
  const { application: app } = detail;
  const today = localDate();
  const contactOptions = [
    // Les contacts liés à la candidature d'abord.
    ...detail.contacts.map((c) => ({ id: c.id, name: c.name, detail: c.relation ?? c.role })),
    ...allContacts.filter((c) => !detail.contacts.some((l) => l.id === c.id)).map((c) => ({ id: c.id, name: c.name, detail: c.company })),
  ];
  const openTasks = detail.tasks.filter((t) => !t.doneAt && !t.cancelledAt);
  const closedTasks = detail.tasks.filter((t) => t.doneAt || t.cancelledAt);
  const now = localDateTime();
  const meetings = detail.interactions
    .filter((i) => i.type === "interview" || i.type === "call" || i.type === "meeting")
    .sort((a, b) => a.date.localeCompare(b.date));
  const analysis = match && {
    score: match.score,
    mine: match.mine.map((h) => h.keyword.label),
    missing: match.missing.map((h) => h.keyword.label),
    segments: highlightSegments(app.offerText!, match.hits),
  };

  const info: [string, React.ReactNode][] = [
    ["Source", app.source && SOURCE_LABELS[app.source]],
    ["Lieu", [app.location, app.remote && REMOTE_LABELS[app.remote]].filter(Boolean).join(" · ")],
    ["Durée", app.duration],
    ["Début", app.startDate],
    ["Gratification", app.stipend],
    ["Date limite", app.deadline && formatDay(app.deadline)],
    ["Envoyée le", app.sentDate && formatDay(app.sentDate)],
    ["Score", app.matchScore != null && `${Math.round(app.matchScore * 100)} %`],
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <title>{`${app.company} · Stage Tracker`}</title>
      {app.deletedAt && <RestoreBanner kind="application" id={app.id} />}

      <Link to="/candidatures" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Candidatures
      </Link>

      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="flex w-full min-w-0 items-start gap-3.5 sm:w-auto sm:flex-1">
          <CompanyMark name={app.company} className="size-12 rounded-2xl text-sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-heading text-2xl font-bold tracking-tight md:text-[28px]">{app.company}</h1>
              <PriorityBadge priority={app.priority} />
            </div>
            <p className="text-sm text-muted-foreground">{app.title || "Poste à préciser"}</p>
            {detail.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {detail.tags.map((t) => (
                  <span key={t} className="rounded-full bg-muted px-2 text-[11px] text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!app.deletedAt && <StatusSelect applicationId={app.id} company={app.company} status={app.status} />}
          {app.offerUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={app.offerUrl} target="_blank" rel="noreferrer">
                <ExternalLink /> Offre
              </a>
            </Button>
          )}
          <EditApplicationButton application={app} tags={detail.tags} tagSuggestions={tagSuggestions}>
            <Pencil /> Modifier
          </EditApplicationButton>
          {!app.deletedAt && <TrashButton kind="application" id={app.id} label={app.company} redirectTo="/candidatures" />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid min-w-0 content-start gap-4">
          {!app.deletedAt && (
            <InterviewsPanel
              application={{ id: app.id, company: app.company }}
              interviews={meetings}
              pendingKind={pendingKind}
              defaultKind={STATUS_INTERVIEW_KINDS[app.status]?.[0] ?? "hr"}
              now={now}
            />
          )}
          <Panel
            title="Timeline"
            count={detail.interactions.length}
            actions={
              <InteractionDialog
                applicationId={app.id}
                defaultContactId={detail.contacts[0]?.id ?? null}
                contacts={contactOptions}
                trigger={
                  <Button variant="ghost" size="sm">
                    <MessageSquarePlus /> Échange
                  </Button>
                }
              />
            }
          >
            <Timeline interactions={detail.interactions} history={detail.history} contacts={contactOptions} now={now} />
          </Panel>

          {!app.deletedAt && <OfferAnalysis applicationId={app.id} offerText={app.offerText} offerUrl={app.offerUrl} analysis={analysis} />}

          {app.notes && (
            <Panel title="Notes">
              <p className="py-1 text-[13px] whitespace-pre-wrap">{app.notes}</p>
            </Panel>
          )}
        </div>

        <div className="grid content-start gap-4">
          <Panel title="Infos">
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 py-1 text-[13px]">
              {info.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 truncate">{value || <span className="text-muted-foreground/50">—</span>}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Tâches" count={openTasks.length} tone="task">
            {openTasks.map((t) => (
              <TaskRow key={t.id} task={t} today={today} showCompany={false} />
            ))}
            <AddTaskForm applicationId={app.id} />
            {closedTasks.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">{closedTasks.length} terminée(s) ou annulée(s)</summary>
                {closedTasks.map((t) => (
                  <TaskRow key={t.id} task={t} today={today} showCompany={false} />
                ))}
              </details>
            )}
          </Panel>

          <Panel
            title="Contacts"
            count={detail.contacts.length}
            actions={
              <ContactsPanelActions application={{ id: app.id, company: app.company }} linkedIds={detail.contacts.map((c) => c.id)} allContacts={allContacts} />
            }
          >
            <LinkedContactsList applicationId={app.id} contacts={detail.contacts} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
