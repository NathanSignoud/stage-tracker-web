import { applyPlan, cmp, insert, row, update } from "@/lib/db";
import { addDays, localDate } from "@/lib/dates";
import type { Task } from "@/lib/types";
import type { TaskInput } from "@/lib/validation";
import { isOpenTask, NotFoundError } from "./applications";
import { allApplications, allTasks } from "./tables";

export async function createTask(input: TaskInput, now = new Date()): Promise<number> {
  return (await applyPlan([insert("tasks", { ...input, origin: "manual", createdAt: now.toISOString() })]))[0]!;
}

export async function setTaskDone(id: number, done: boolean, now = new Date()): Promise<void> {
  await applyPlan([update("tasks", { id }, { doneAt: done ? now.toISOString() : null, cancelledAt: null })]);
}

/** Reporte une tâche de `days` jours, à partir de son échéance ou d'aujourd'hui si elle est passée. */
export async function postponeTask(id: number, days: number, now = new Date()): Promise<void> {
  const task = await row<Task>("tasks", { id });
  if (!task) throw new NotFoundError("Tâche introuvable");
  const today = localDate(now);
  const from = task.dueDate && task.dueDate > today ? task.dueDate : today;
  await applyPlan([update("tasks", { id }, { dueDate: addDays(from, days) })]);
}

export type TaskListItem = Task & { company: string | null };

/** Toutes les tâches hors corbeille (et hors candidatures à la corbeille), ouvertes d'abord. */
export async function listTasks(): Promise<TaskListItem[]> {
  const [allTaskRows, apps] = await Promise.all([allTasks(), allApplications()]);
  const tasks = allTaskRows.filter((t) => !t.deletedAt);
  const appById = new Map(apps.map((a) => [a.id, a]));
  return tasks
    .filter((t) => !(t.applicationId && appById.get(t.applicationId)?.deletedAt))
    .sort((a, b) => cmp(!isOpenTask(a), !isOpenTask(b)) || cmp(a.dueDate == null, b.dueDate == null) || cmp(a.dueDate, b.dueDate))
    .map((t) => ({ ...t, company: (t.applicationId && appById.get(t.applicationId)?.company) || null }));
}
