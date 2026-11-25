import { PageHeader, Panel } from "@/components/page-header";
import { AddTaskForm } from "@/components/tasks/add-task-form";
import { TaskRow } from "@/components/task-row";
import { PageLoading } from "@/components/page-loading";
import { useData } from "@/lib/data";
import { localDate } from "@/lib/dates";
import { listApplications } from "@/services/applications";
import { listTasks } from "@/services/tasks";

async function loadTasks() {
  const [all, apps] = await Promise.all([listTasks(), listApplications()]);
  return { all, applications: apps.map((a) => ({ id: a.id, company: a.company })) };
}

export function TasksPage() {
  const { data, error } = useData(loadTasks);
  if (!data) return <PageLoading error={error} />;
  const { all, applications } = data;
  const today = localDate();
  const open = all.filter((t) => !t.doneAt && !t.cancelledAt);
  const groups = [
    { title: "En retard", items: open.filter((t) => t.dueDate && t.dueDate < today) },
    { title: "Aujourd'hui", items: open.filter((t) => t.dueDate === today) },
    { title: "À venir", items: open.filter((t) => t.dueDate && t.dueDate > today) },
    { title: "Sans échéance", items: open.filter((t) => !t.dueDate) },
  ];
  const closed = all.filter((t) => t.doneAt || t.cancelledAt).slice(0, 30);

  return (
    <div className="mx-auto max-w-3xl">
      <title>Tâches · Stage Tracker</title>
      <PageHeader title="Tâches" description={`${open.length} ouverte${open.length > 1 ? "s" : ""}`} />
      <div className="mb-4 rounded-3xl bg-card ring-1 ring-border px-5 py-3">
        <AddTaskForm applications={applications} />
      </div>
      <div className="grid gap-4">
        {groups
          .filter((g) => g.items.length)
          .map((g) => (
            <Panel key={g.title} title={g.title} count={g.items.length}>
              {g.items.map((t) => (
                <TaskRow key={t.id} task={t} company={t.company} today={today} />
              ))}
            </Panel>
          ))}
        {open.length === 0 && <p className="text-center text-[13px] text-muted-foreground">Aucune tâche ouverte.</p>}
        {closed.length > 0 && (
          <Panel title="Récemment terminées ou annulées" count={closed.length}>
            {closed.map((t) => (
              <TaskRow key={t.id} task={t} company={t.company} today={today} />
            ))}
          </Panel>
        )}
      </div>
    </div>
  );
}
