import type { PrepQuestionKind } from "./constants";

/** Questions classiques proposées pour démarrer une fiche de préparation (stage IA). */
export const DEFAULT_PREP_QUESTIONS: { kind: PrepQuestionKind; question: string }[] = [
  { kind: "answer", question: "Présentez-vous en deux minutes." },
  { kind: "answer", question: "Pourquoi notre entreprise ?" },
  { kind: "answer", question: "Pourquoi ce stage, et qu'en attendez-vous ?" },
  { kind: "answer", question: "Parlez-moi d'un projet d'IA dont vous êtes fier·e : données, modèle, métriques, résultats." },
  { kind: "answer", question: "Racontez une difficulté technique et comment vous l'avez résolue." },
  { kind: "answer", question: "Comment diagnostiquer et corriger un sur-apprentissage ?" },
  { kind: "answer", question: "Expliquez le mécanisme d'attention d'un Transformer." },
  { kind: "answer", question: "Comment travaillez-vous en équipe ? Un exemple de désaccord ?" },
  { kind: "answer", question: "Quels sont vos points forts et vos axes de progrès ?" },
  { kind: "answer", question: "Où vous voyez-vous après ce stage ?" },
  { kind: "ask", question: "À quoi ressemblerait une semaine type pendant le stage ?" },
  { kind: "ask", question: "Sur quel projet travaillerais-je, et avec quelle équipe / quel encadrement ?" },
  { kind: "ask", question: "Quelle stack et quelle infrastructure (GPU, MLOps, données) ?" },
  { kind: "ask", question: "Comment mesurez-vous la réussite d'un stage chez vous ?" },
  { kind: "ask", question: "Une embauche est-elle envisageable à l'issue du stage ?" },
  { kind: "ask", question: "Quelles sont les prochaines étapes du processus ?" },
];

type Reviewable = { kind: PrepQuestionKind; confidence: number; lastReviewedAt: string | null; id: number };

/** Ordre des flashcards : les moins maîtrisées d'abord, puis les moins récemment révisées. */
export function flashcardOrder<T extends Reviewable>(questions: T[]): T[] {
  return questions
    .filter((q) => q.kind === "answer")
    .sort(
      (a, b) =>
        a.confidence - b.confidence ||
        (a.lastReviewedAt ?? "").localeCompare(b.lastReviewedAt ?? "") ||
        a.id - b.id,
    );
}
