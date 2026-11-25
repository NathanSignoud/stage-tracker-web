import { z } from "zod";
import {
  DOCUMENT_KINDS,
  INTERACTION_TYPES,
  INTERVIEW_KINDS,
  type Priority,
  REMOTE_MODES,
  SOURCES,
  STATUSES,
} from "@/lib/domain/constants";

// Schémas de validation des saisies (Server Actions). Les champs optionnels vides deviennent null.

const optionalText = z
  .string()
  .nullish()
  .transform((v) => (v?.trim() ? v.trim() : null));

const optionalDay = z
  .string()
  .nullish()
  .transform((v) => (v?.trim() ? v.trim() : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date invalide (AAAA-MM-JJ)");

const priority = z.coerce
  .number()
  .int()
  .min(1)
  .max(3)
  .default(2)
  .transform((v) => v as Priority);

const optionalId = z.coerce.number().int().positive().nullish().transform((v) => v ?? null);

export const applicationInputSchema = z.object({
  company: z.string().trim().min(1, "L'entreprise est obligatoire"),
  title: z.string().trim().default(""),
  offerUrl: optionalText,
  offerText: optionalText,
  source: z.enum(SOURCES).nullish().transform((v) => v ?? null),
  location: optionalText,
  remote: z.enum(REMOTE_MODES).nullish().transform((v) => v ?? null),
  duration: optionalText,
  startDate: optionalText,
  stipend: optionalText,
  deadline: optionalDay,
  sentDate: optionalDay,
  priority: priority,
  notes: optionalText,
  tags: z.array(z.string()).optional(),
});
export type ApplicationInput = z.output<typeof applicationInputSchema>;

export const quickAddSchema = z.object({
  company: z.string().trim().min(1, "L'entreprise est obligatoire"),
  title: z.string().trim().default(""),
  offerUrl: optionalText,
  // Remplis par « Remplir depuis le lien » (import de l'offre).
  offerText: optionalText,
  location: optionalText,
  deadline: optionalDay,
  remote: z.enum(REMOTE_MODES).nullish().transform((v) => v ?? null),
  status: z.enum(STATUSES).default("to_explore"),
  priority: priority,
});
export type QuickAddInput = z.output<typeof quickAddSchema>;

export const interactionInputSchema = z.object({
  applicationId: optionalId,
  contactId: optionalId,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Date et heure invalides"),
  type: z.enum(INTERACTION_TYPES),
  summary: z.string().trim().min(1, "Le résumé est obligatoire"),
  content: optionalText,
  location: optionalText,
  interviewKind: z.enum(INTERVIEW_KINDS).nullish().transform((v) => v ?? null),
  durationMinutes: z.coerce.number().int().min(5).max(600).nullish().transform((v) => v ?? null),
  nextAction: optionalText,
  nextActionDate: optionalDay,
});
export type InteractionInput = z.output<typeof interactionInputSchema>;

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
  role: optionalText,
  company: optionalText,
  email: optionalText,
  phone: optionalText,
  linkedin: optionalText,
  howWeMet: optionalText,
  notes: optionalText,
});
export type ContactInput = z.output<typeof contactInputSchema>;

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire"),
  dueDate: optionalDay,
  applicationId: optionalId,
});
export type TaskInput = z.output<typeof taskInputSchema>;

export const documentInputSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  label: z.string().trim().min(1, "Le libellé est obligatoire"),
  content: optionalText,
});
export type DocumentInput = z.output<typeof documentInputSchema>;

const delay = z.coerce.number().int().min(0).max(365);

export const settingsInputSchema = z.object({
  profile: z.object({
    fullName: z.string().trim(),
    email: z.string().trim(),
    phone: z.string().trim(),
    linkedin: z.string().trim(),
    summary: z.string().trim(),
    startDate: z.string().trim(),
    domains: z.string().trim(),
    skills: z.string().trim(),
    location: z.string().trim(),
  }),
  followUpDelayDays: delay,
  secondFollowUpDelayDays: delay,
  staleAfterDays: z.coerce.number().int().min(1).max(365),
  weeklyGoal: z.coerce.number().int().min(0).max(100),
  thankYouReminder: z.boolean(),
  postInterviewFollowUpDays: delay,
});
