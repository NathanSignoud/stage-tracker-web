import { z } from "zod";
import { INTERVIEW_STATUSES, PREP_QUESTION_KINDS, TEMPLATE_KINDS, type Status } from "@/lib/domain/constants";
import type { ImportedOffer } from "@/lib/domain/offer-parsing";
import { supabase } from "@/lib/supabase";
import { getApplicationDetail, NotFoundError } from "@/services/applications";
import { recordMessageSent } from "@/services/messages";
import { addDefaultPrepQuestions, addPrepQuestion, reviewPrepQuestion, saveCompanyNotes, updatePrepQuestion } from "@/services/prep";
import { listTemplates, renderForApplication, resetTemplate, updateTemplate, type RenderedTemplate } from "@/services/templates";
import { applyImportedOffer, getLiveApplication, setOfferText } from "@/services/applications";
import { saveLetterVersion, setBaseDocument } from "@/services/documents";
import { createKeyword, deleteKeyword, updateKeyword } from "@/services/keywords";
import { errorMessage, mutate, type ActionResult } from "./result";

const id = z.coerce.number().int().positive();

/** Lecture seule : pas de rechargement des pages, l'erreur devient un message. */
async function read<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

// --- Mots-clés et analyse de l'offre ------------------------------------------------

const keywordSchema = z.object({
  label: z.string().trim().min(1, "Le mot-clé est vide"),
  category: z.string().trim().nullish().transform((v) => v || null),
  aliases: z.array(z.string()).default([]),
  mine: z.boolean().default(false),
});

export async function createKeywordAction(input: unknown) {
  return mutate(() => createKeyword(keywordSchema.parse(input)));
}

export async function updateKeywordAction(keywordId: number, patch: unknown) {
  return mutate(() => updateKeyword(id.parse(keywordId), keywordSchema.partial().parse(patch)));
}

export async function deleteKeywordAction(keywordId: number) {
  return mutate(() => deleteKeyword(id.parse(keywordId)));
}

export async function setOfferTextAction(applicationId: number, text: string) {
  return mutate(() => setOfferText(id.parse(applicationId), z.string().max(100_000).parse(text)));
}

/** Lit une offre depuis son lien (pour pré-remplir un formulaire, rien n'est enregistré). */
export async function importOfferAction(url: string): Promise<ActionResult<ImportedOffer & { url: string }>> {
  try {
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/offer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ url: z.string().max(2000).parse(url) }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error || "Lecture impossible : copie-colle le texte de l'offre." };
    }
    // Le serveur transmet la page telle quelle ; on la lit ici (bibliothèque chargée seulement à ce moment-là).
    const [html, { parseOfferHtml }] = await Promise.all([res.text(), import("@/lib/domain/offer-parsing")]);
    const offer = parseOfferHtml(html);
    if (!offer.title && !offer.offerText) {
      return { ok: false, error: "Impossible de lire cette page (contenu chargé dynamiquement ?) : copie-colle le texte de l'offre." };
    }
    return { ok: true, data: { ...offer, url: res.headers.get("X-Offer-Url") ?? url } };
  } catch {
    return { ok: false, error: "Page injoignable ou trop volumineuse : copie-colle le texte de l'offre." };
  }
}

/** Importe le texte de l'offre depuis le lien enregistré sur la candidature (et complète lieu / date limite). */
export async function importOfferIntoApplicationAction(applicationId: number) {
  const app = await getLiveApplication(id.parse(applicationId));
  if (!app.offerUrl) return { ok: false as const, error: "Aucun lien d'offre sur cette candidature" };
  const imported = await importOfferAction(app.offerUrl);
  if (!imported.ok) return imported;
  return mutate(async () => {
    await applyImportedOffer(app, imported.data);
    return imported.data.method;
  });
}

// --- Documents de base -----------------------------------------------------------------------

export async function setBaseDocumentAction(documentId: number) {
  return mutate(() => setBaseDocument(id.parse(documentId)));
}

export async function saveLetterVersionAction(applicationId: number, content: string) {
  return mutate(() => saveLetterVersion(id.parse(applicationId), z.string().max(50_000).parse(content)));
}

// --- Gabarits, prompts et messages -----------------------------------------------------

export async function updateTemplateAction(templateId: number, input: unknown) {
  const schema = z.object({
    name: z.string().trim().min(1, "Le nom est vide"),
    subject: z.string().nullish().transform((v) => v ?? null),
    body: z.string().min(1, "Le texte est vide"),
  });
  return mutate(() => updateTemplate(id.parse(templateId), schema.parse(input)));
}

export async function resetTemplateAction(templateId: number) {
  return mutate(() => resetTemplate(id.parse(templateId)));
}

export async function renderTemplateAction(kind: string, key: string, applicationId: number): Promise<ActionResult<RenderedTemplate>> {
  return read(() => renderForApplication(z.enum(TEMPLATE_KINDS).parse(kind), z.string().parse(key), id.parse(applicationId)));
}

export type MessageComposer = {
  company: string;
  templates: RenderedTemplate[];
  contacts: { id: number; name: string; email: string | null; relation: string | null }[];
  /** Gabarit proposé selon l'étape (relance après candidature ou après entretien). */
  suggestedKey: string;
};

export async function messageComposerAction(applicationId: number): Promise<ActionResult<MessageComposer>> {
  return read(async () => {
    const appId = id.parse(applicationId);
    const detail = await getApplicationDetail(appId);
    if (!detail) throw new NotFoundError("Candidature introuvable");
    const inInterview = [...INTERVIEW_STATUSES, "offer" as Status].includes(detail.application.status);
    const templates = await listTemplates("message");
    return {
      company: detail.application.company,
      templates: await Promise.all(templates.map((t) => renderForApplication("message", t.key, appId))),
      contacts: detail.contacts.map((c) => ({ id: c.id, name: c.name, email: c.email, relation: c.relation })),
      suggestedKey: inInterview ? "follow_up_interview" : "follow_up",
    };
  });
}

/**
 * « Marquer comme envoyé » : l'échange est consigné dans la timeline, une relance fait passer la
 * candidature en Relancée (ou coche la relance), un remerciement coche la tâche « remerciement ».
 */
export async function recordMessageSentAction(applicationId: number, input: unknown) {
  const schema = z.object({
    templateKey: z.string(),
    templateName: z.string(),
    contactId: z.coerce.number().int().positive().nullish().transform((v) => v ?? null),
    subject: z.string().nullish(),
    body: z.string().min(1),
  });
  return mutate(() => recordMessageSent(id.parse(applicationId), schema.parse(input)));
}

// --- Préparation d'entretien ----------------------------------------------------------------

export async function saveCompanyNotesAction(applicationId: number, notes: string) {
  return mutate(() => saveCompanyNotes(id.parse(applicationId), z.string().max(50_000).parse(notes)));
}

export async function addPrepQuestionAction(applicationId: number, input: unknown) {
  const schema = z.object({
    kind: z.enum(PREP_QUESTION_KINDS),
    question: z.string().trim().min(1, "La question est vide"),
    answer: z.string().nullish(),
  });
  return mutate(() => addPrepQuestion(id.parse(applicationId), schema.parse(input)));
}

export async function updatePrepQuestionAction(questionId: number, input: unknown) {
  const schema = z.object({
    question: z.string().trim().min(1, "La question est vide"),
    answer: z.string().nullish().transform((v) => v ?? null),
  });
  return mutate(() => updatePrepQuestion(id.parse(questionId), schema.parse(input)));
}

export async function reviewPrepQuestionAction(questionId: number, confidence: number) {
  return mutate(() => reviewPrepQuestion(id.parse(questionId), z.union([z.literal(0), z.literal(1), z.literal(2)]).parse(confidence)));
}

export async function addDefaultPrepQuestionsAction(applicationId: number) {
  return mutate(() => addDefaultPrepQuestions(id.parse(applicationId)));
}
