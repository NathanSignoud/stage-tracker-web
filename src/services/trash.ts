import { applyPlan, cmp, remove, row, rows, update, type PlanOp, type Table } from "@/lib/db";
import { INTERACTION_LABELS, type TrashKind } from "@/lib/domain/constants";
import { files } from "@/lib/storage";
import type { Application, Company, Contact, Document, Interaction, PrepQuestion, Task } from "@/lib/types";
import { NotFoundError } from "./applications";

// Corbeille : « supprimer » renseigne deleted_at ; seule la corbeille supprime définitivement.

const tables: Record<TrashKind, Table> = {
  application: "applications",
  contact: "contacts",
  interaction: "interactions",
  task: "tasks",
  document: "documents",
  question: "prep_questions",
  company: "companies",
};

async function trashed(kind: TrashKind, id: number): Promise<{ deletedAt: string | null; filePath?: string | null }> {
  const item = await row<{ deletedAt: string | null; filePath?: string | null }>(tables[kind], { id });
  if (!item) throw new NotFoundError();
  return item;
}

export async function moveToTrash(kind: TrashKind, id: number, now = new Date()): Promise<void> {
  const stamp = now.toISOString();
  const ops: PlanOp[] = [update(tables[kind], { id }, { deletedAt: stamp })];
  // Les tâches « prochaine action » d'un échange partent et reviennent avec lui.
  if (kind === "interaction") {
    const linked = (await rows<Task>("tasks", { interactionId: id, deletedAt: null })).map((t) => t.id);
    if (linked.length) ops.push(update("tasks", { id: linked }, { deletedAt: stamp }));
  }
  await applyPlan(ops);
}

export async function restoreFromTrash(kind: TrashKind, id: number): Promise<void> {
  const { deletedAt } = await trashed(kind, id);
  const ops: PlanOp[] = [update(tables[kind], { id }, { deletedAt: null })];
  if (kind === "interaction" && deletedAt) {
    ops.push(update("tasks", { interactionId: id, deletedAt }, { deletedAt: null }));
  }
  await applyPlan(ops);
}

/** Suppression définitive, uniquement pour un élément déjà dans la corbeille. */
export async function purgeFromTrash(kind: TrashKind, id: number): Promise<void> {
  const { deletedAt, filePath } = await trashed(kind, id);
  if (!deletedAt) throw new Error("Seuls les éléments de la corbeille peuvent être supprimés définitivement");
  const ops: PlanOp[] = [];
  if (kind === "interaction") {
    const linked = (await rows<Task>("tasks", { interactionId: id })).filter((t) => t.deletedAt).map((t) => t.id);
    if (linked.length) ops.push(remove("tasks", { id: linked }));
  }
  ops.push(remove(tables[kind], { id }));
  await applyPlan(ops);
  // Le fichier après la ligne : la base ne pointe jamais vers un fichier absent.
  // shortcut: si cette suppression échoue (réseau), le fichier reste orphelin dans le stockage ; à nettoyer à l'étape 6 si besoin.
  if (kind === "document" && filePath) await files.remove([filePath]).catch(() => {});
}

export type TrashItem = { kind: TrashKind; id: number; label: string; detail: string; deletedAt: string };

export async function listTrash(): Promise<TrashItem[]> {
  const [apps, contacts, interactions, tasks, questions, companies, documents] = await Promise.all([
    rows<Application>("applications"),
    rows<Contact>("contacts"),
    rows<Interaction>("interactions"),
    rows<Task>("tasks"),
    rows<PrepQuestion>("prep_questions"),
    rows<Company>("companies"),
    rows<Document>("documents"),
  ]);
  const company = (id: number | null) => (id && apps.find((a) => a.id === id)?.company) || null;
  const deletedInteractions = new Set(interactions.filter((i) => i.deletedAt).map((i) => i.id));
  const items: TrashItem[] = [
    ...apps.filter((a) => a.deletedAt).map((a) => ({ kind: "application" as const, id: a.id, label: a.company, detail: a.title, deletedAt: a.deletedAt! })),
    ...contacts
      .filter((c) => c.deletedAt)
      .map((c) => ({ kind: "contact" as const, id: c.id, label: c.name, detail: [c.role, c.company].filter(Boolean).join(" · "), deletedAt: c.deletedAt! })),
    ...interactions
      .filter((i) => i.deletedAt)
      .map((i) => ({
        kind: "interaction" as const,
        id: i.id,
        label: i.summary,
        detail: [INTERACTION_LABELS[i.type], company(i.applicationId)].filter(Boolean).join(" · "),
        deletedAt: i.deletedAt!,
      })),
    ...tasks
      .filter((t) => t.deletedAt && !(t.interactionId && deletedInteractions.has(t.interactionId)))
      .map((t) => ({ kind: "task" as const, id: t.id, label: t.title, detail: company(t.applicationId) ?? "", deletedAt: t.deletedAt! })),
    ...questions
      .filter((q) => q.deletedAt)
      .map((q) => ({ kind: "question" as const, id: q.id, label: q.question, detail: company(q.applicationId) ?? "", deletedAt: q.deletedAt! })),
    ...companies
      .filter((c) => c.deletedAt)
      .map((c) => ({ kind: "company" as const, id: c.id, label: c.name, detail: [c.sector, c.location].filter(Boolean).join(" · "), deletedAt: c.deletedAt! })),
    ...documents
      .filter((d) => d.deletedAt)
      .map((d) => ({ kind: "document" as const, id: d.id, label: d.label, detail: d.fileName ?? "", deletedAt: d.deletedAt! })),
  ];
  return items.sort((a, b) => cmp(b.deletedAt, a.deletedAt));
}
