import { z } from "zod";
import { TRASH_KINDS } from "@/lib/domain/constants";
import { extractDocumentText } from "@/lib/text-extraction";
import { contactInputSchema, documentInputSchema, interactionInputSchema, settingsInputSchema, taskInputSchema } from "@/lib/validation";
import { createContact, updateContact } from "@/services/contacts";
import { attachDocumentFile, linkDocument, saveDocument, unlinkDocument } from "@/services/documents";
import { regenerateCalendarToken } from "@/services/calendar";
import { createInteraction, updateInteraction } from "@/services/interactions";
import { updateSettings } from "@/services/settings";
import { createTask, postponeTask, setTaskDone } from "@/services/tasks";
import { moveToTrash, purgeFromTrash, restoreFromTrash } from "@/services/trash";
import { search, type SearchResults } from "@/services/search";
import { errorMessage, mutate, type ActionResult } from "./result";

const id = z.coerce.number().int().positive();
const kind = z.enum(TRASH_KINDS);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish().or(z.literal("")).transform((v) => v || null);

// --- Échanges ---------------------------------------------------------------

export async function createInteractionAction(input: unknown) {
  return mutate(() => createInteraction(interactionInputSchema.parse(input)));
}

export async function updateInteractionAction(interactionId: number, input: unknown) {
  return mutate(() => updateInteraction(id.parse(interactionId), interactionInputSchema.parse(input)));
}

// --- Tâches -----------------------------------------------------------------

export async function createTaskAction(input: unknown) {
  return mutate(() => createTask(taskInputSchema.parse(input)));
}

export async function setTaskDoneAction(taskId: number, done: boolean) {
  return mutate(() => setTaskDone(id.parse(taskId), z.boolean().parse(done)));
}

export async function postponeTaskAction(taskId: number, days: number) {
  return mutate(() => postponeTask(id.parse(taskId), z.number().int().min(1).max(60).parse(days)));
}

// --- Contacts ---------------------------------------------------------------

export async function createContactAction(input: unknown) {
  return mutate(() => createContact(contactInputSchema.parse(input)));
}

export async function updateContactAction(contactId: number, input: unknown) {
  return mutate(() => updateContact(id.parse(contactId), contactInputSchema.parse(input)));
}

// --- Documents --------------------------------------------------------------

/** FormData : kind, label, content?, file?, applicationId?, sentAt?, documentId? (lier un existant). */
export async function saveDocumentAction(form: FormData) {
  return mutate(async () => {
    const raw = form.get("file");
    const file = raw instanceof File && raw.size > 0 ? raw : null;
    const applicationId = id.nullish().parse(form.get("applicationId") || null);
    const existing = id.nullish().parse(form.get("documentId") || null);
    const sentAt = day.parse(form.get("sentAt"));
    if (existing) {
      if (applicationId) await linkDocument(applicationId, existing, sentAt);
      return existing;
    }
    // Pas de texte collé : on l'extrait du fichier (DOCX, PDF, Markdown) pour le diff et les prompts.
    const pasted = String(form.get("content") ?? "").trim();
    const extracted = file && !pasted ? await extractDocumentText(file.name, new Uint8Array(await file.arrayBuffer())) : null;
    const input = documentInputSchema.parse({ kind: form.get("kind"), label: form.get("label"), content: pasted || extracted });
    if (!file && !input.content) throw new Error("Ajoute un fichier ou colle le texte du document");
    return saveDocument(input, file, applicationId ? { applicationId, sentAt } : null);
  });
}

export async function attachDocumentFileAction(documentId: number, file: File) {
  return mutate(async () => {
    const text = await extractDocumentText(file.name, new Uint8Array(await file.arrayBuffer()));
    await attachDocumentFile(id.parse(documentId), file, text);
  });
}

export async function unlinkDocumentAction(applicationId: number, documentId: number) {
  return mutate(() => unlinkDocument(id.parse(applicationId), id.parse(documentId)));
}

// --- Corbeille --------------------------------------------------------------

export async function moveToTrashAction(k: string, itemId: number) {
  return mutate(() => moveToTrash(kind.parse(k), id.parse(itemId)));
}

export async function restoreFromTrashAction(k: string, itemId: number) {
  return mutate(() => restoreFromTrash(kind.parse(k), id.parse(itemId)));
}

export async function purgeFromTrashAction(k: string, itemId: number) {
  return mutate(() => purgeFromTrash(kind.parse(k), id.parse(itemId)));
}

// --- Réglages ---------------------------------------------------------------

export async function updateSettingsAction(input: unknown) {
  return mutate(() => updateSettings(settingsInputSchema.parse(input)));
}

// --- Agenda ------------------------------------------------------------------

export async function regenerateCalendarTokenAction() {
  return mutate(() => regenerateCalendarToken());
}

// --- Recherche (lecture seule) ----------------------------------------------

export async function searchAction(query: string): Promise<ActionResult<SearchResults>> {
  try {
    return { ok: true, data: await search(z.string().max(200).parse(query)) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
