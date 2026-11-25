import { z } from "zod";
import { TRASH_KINDS } from "@/lib/domain/constants";
import { contactInputSchema, documentInputSchema, interactionInputSchema, settingsInputSchema, taskInputSchema } from "@/lib/validation";
import { createContact, updateContact } from "@/services/contacts";
import { createAndLinkDocument, createDocument, linkDocument, unlinkDocument } from "@/services/documents";
import { createInteraction, updateInteraction } from "@/services/interactions";
import { updateSettings } from "@/services/settings";
import { createTask, postponeTask, setTaskDone } from "@/services/tasks";
import { moveToTrash, purgeFromTrash, restoreFromTrash } from "@/services/trash";
import { mutate } from "./result";

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
    const file = form.get("file");
    // shortcut: pas encore de stockage de fichiers (Supabase Storage, étape 4) : on demande le texte.
    if (file instanceof File && file.size > 0) throw new Error("L'envoi de fichiers arrive bientôt. En attendant, colle le texte du document.");
    const applicationId = id.nullish().parse(form.get("applicationId") || null);
    const existing = id.nullish().parse(form.get("documentId") || null);
    const sentAt = day.parse(form.get("sentAt"));
    if (existing) {
      if (applicationId) await linkDocument(applicationId, existing, sentAt);
      return existing;
    }
    const input = documentInputSchema.parse({ kind: form.get("kind"), label: form.get("label"), content: String(form.get("content") ?? "").trim() });
    if (!input.content) throw new Error("Colle le texte du document");
    return applicationId ? createAndLinkDocument(input, applicationId, sentAt) : createDocument(input);
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
