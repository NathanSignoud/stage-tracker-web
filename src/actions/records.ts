import { z } from "zod";
import { TRASH_KINDS } from "@/lib/domain/constants";
import { contactInputSchema, interactionInputSchema, settingsInputSchema, taskInputSchema } from "@/lib/validation";
import { createContact, updateContact } from "@/services/contacts";
import { createInteraction, updateInteraction } from "@/services/interactions";
import { updateSettings } from "@/services/settings";
import { createTask, postponeTask, setTaskDone } from "@/services/tasks";
import { moveToTrash, purgeFromTrash, restoreFromTrash } from "@/services/trash";
import { mutate } from "./result";

const id = z.coerce.number().int().positive();
const kind = z.enum(TRASH_KINDS);

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
