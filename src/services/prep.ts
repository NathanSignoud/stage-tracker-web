import { applyPlan, cmp, insert, row, rows, update, upsert, type PlanOp } from "@/lib/db";
import type { PrepQuestionKind } from "@/lib/domain/constants";
import { DEFAULT_PREP_QUESTIONS } from "@/lib/domain/prep";
import { normalizeText } from "@/lib/text";
import type { InterviewPrep, PrepQuestion } from "@/lib/types";
import { NotFoundError } from "./applications";

export async function getPrep(applicationId: number) {
  const [prep, questions] = await Promise.all([
    row<InterviewPrep>("interview_preps", { applicationId }),
    rows<PrepQuestion>("prep_questions", { applicationId, deletedAt: null }),
  ]);
  return { notes: prep?.companyNotes ?? null, questions: questions.sort((a, b) => cmp(a.createdAt, b.createdAt) || cmp(a.id, b.id)) };
}

export function saveCompanyNotes(applicationId: number, notes: string, now = new Date()): Promise<void> {
  return upsert("interview_preps", [{ applicationId, companyNotes: notes.trim() ? notes : null, updatedAt: now.toISOString() }], ["applicationId"]);
}

function questionOp(applicationId: number, input: { kind: PrepQuestionKind; question: string; answer?: string | null }, now: Date): PlanOp {
  if (!input.question.trim()) throw new Error("La question est vide");
  return insert("prep_questions", {
    applicationId,
    kind: input.kind,
    question: input.question.trim(),
    answer: input.answer?.trim() || null,
    createdAt: now.toISOString(),
  });
}

export async function addPrepQuestion(
  applicationId: number,
  input: { kind: PrepQuestionKind; question: string; answer?: string | null },
  now = new Date(),
): Promise<number> {
  return (await applyPlan([questionOp(applicationId, input, now)]))[0]!;
}

export async function updatePrepQuestion(id: number, input: { question: string; answer: string | null }): Promise<void> {
  if (!input.question.trim()) throw new Error("La question est vide");
  await applyPlan([update("prep_questions", { id }, { question: input.question.trim(), answer: input.answer?.trim() || null })]);
}

/** Auto-évaluation en mode flashcards : 0 = à revoir, 1 = bien, 2 = parfait. */
export async function reviewPrepQuestion(id: number, confidence: 0 | 1 | 2, now = new Date()): Promise<void> {
  const q = await row<PrepQuestion>("prep_questions", { id });
  if (!q) throw new NotFoundError("Question introuvable");
  await applyPlan([update("prep_questions", { id }, { confidence, reviewCount: q.reviewCount + 1, lastReviewedAt: now.toISOString() })]);
}

/** Ajoute les questions classiques absentes de la fiche (d'un bloc). Renvoie le nombre ajouté. */
export async function addDefaultPrepQuestions(applicationId: number, now = new Date()): Promise<number> {
  const existing = new Set((await getPrep(applicationId)).questions.map((q) => normalizeText(q.question)));
  const ops = DEFAULT_PREP_QUESTIONS.filter((q) => !existing.has(normalizeText(q.question))).map((q) => questionOp(applicationId, q, now));
  await applyPlan(ops);
  return ops.length;
}
