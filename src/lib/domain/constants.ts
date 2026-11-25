// Énumérations métier : valeurs stockées en base (anglais) → libellés affichés (français).

export const STATUSES = [
  "to_explore",
  "to_apply",
  "sent",
  "followed_up",
  "tech_test",
  "hr_interview",
  "tech_interview",
  "offer",
  "accepted",
  "rejected",
  "abandoned",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  to_explore: "À explorer",
  to_apply: "À postuler",
  sent: "Envoyée",
  followed_up: "Relancée",
  tech_test: "Test technique",
  hr_interview: "Entretien RH",
  tech_interview: "Entretien technique",
  offer: "Offre reçue",
  accepted: "Acceptée",
  rejected: "Refusée",
  abandoned: "Abandonnée",
};

/** Statuts finaux, regroupés dans la zone repliable « Clôturées » du Kanban. */
export const CLOSED_STATUSES: readonly Status[] = ["accepted", "rejected", "abandoned"];
export const OPEN_STATUSES: readonly Status[] = STATUSES.filter((s) => !CLOSED_STATUSES.includes(s));
/** Statuts « en attente de réponse » : relances automatiques et détection « sans nouvelles ». */
export const AWAITING_STATUSES: readonly Status[] = ["sent", "followed_up"];
/** Étapes de sélection (test, puis entretiens) : la candidature a reçu une réponse. */
export const INTERVIEW_STATUSES: readonly Status[] = ["tech_test", "hr_interview", "tech_interview"];

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export const SOURCES = [
  "career_site",
  "linkedin",
  "wttj",
  "jobteaser",
  "job_fair",
  "network",
  "spontaneous",
  "france_travail",
  "other",
] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  career_site: "Site carrière",
  linkedin: "LinkedIn",
  wttj: "Welcome to the Jungle",
  jobteaser: "JobTeaser",
  job_fair: "Forum entreprises",
  network: "Réseau / recommandation",
  spontaneous: "Candidature spontanée",
  france_travail: "France Travail",
  other: "Autre",
};

export const REMOTE_MODES = ["onsite", "hybrid", "full"] as const;
export type RemoteMode = (typeof REMOTE_MODES)[number];

export const REMOTE_LABELS: Record<RemoteMode, string> = {
  onsite: "Sur site",
  hybrid: "Hybride",
  full: "Full remote",
};

export const INTERACTION_TYPES = [
  "email_sent",
  "email_received",
  "call",
  "interview",
  "linkedin",
  "meeting",
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  email_sent: "Email envoyé",
  email_received: "Email reçu",
  call: "Appel",
  interview: "Entretien",
  linkedin: "Message LinkedIn",
  meeting: "Rencontre",
};

/** Types d'échange qui, datés dans le futur, apparaissent comme « entretiens à venir ». */
export const APPOINTMENT_TYPES: readonly InteractionType[] = ["interview", "call"];

export const INTERVIEW_KINDS = ["test", "hr", "tech", "other"] as const;
export type InterviewKind = (typeof INTERVIEW_KINDS)[number];

export const INTERVIEW_KIND_LABELS: Record<InterviewKind, string> = {
  hr: "Entretien RH",
  tech: "Entretien technique",
  test: "Test technique",
  other: "Entretien",
};

export const INTERVIEW_KIND_SHORT: Record<InterviewKind, string> = {
  hr: "RH",
  tech: "Technique",
  test: "Test",
  other: "Autre",
};

/**
 * Statuts qui attendent un entretien daté, et son type. Le test technique n'en fait pas partie : il se fait
 * sans créneau (à rendre avant une date), avant l'appel RH.
 */
export const STATUS_INTERVIEW_KINDS: Partial<Record<Status, readonly InterviewKind[]>> = {
  hr_interview: ["hr"],
  tech_interview: ["tech"],
};

/** Statut vers lequel avancer quand on planifie un entretien de ce type. */
export const INTERVIEW_KIND_STATUS: Partial<Record<InterviewKind, Status>> = {
  hr: "hr_interview",
  tech: "tech_interview",
  test: "tech_test",
};

export const DEFAULT_INTERVIEW_MINUTES = 60;

export const TASK_ORIGINS = ["manual", "auto_followup", "interaction", "thank_you"] as const;
export type TaskOrigin = (typeof TASK_ORIGINS)[number];

export const DOCUMENT_KINDS = ["cv", "letter", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  cv: "CV",
  letter: "Lettre de motivation",
  other: "Autre",
};

export const PRIORITIES = [1, 2, 3] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: "Haute",
  2: "Moyenne",
  3: "Basse",
};

export const TRASH_KINDS = ["application", "contact", "interaction", "task", "document", "question", "company"] as const;
export type TrashKind = (typeof TRASH_KINDS)[number];

export const TRASH_KIND_LABELS: Record<TrashKind, string> = {
  application: "Candidature",
  contact: "Contact",
  interaction: "Échange",
  task: "Tâche",
  document: "Document",
  question: "Question de préparation",
  company: "Entreprise",
};

/** Entreprises cibles (repérées avant toute candidature). « Candidature » se déduit des candidatures existantes. */
export const COMPANY_STATUSES = ["to_explore", "interesting", "dismissed"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  to_explore: "À explorer",
  interesting: "Intéressante",
  dismissed: "Écartée",
};

export const TEMPLATE_KINDS = ["prompt", "message"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export const PREP_QUESTION_KINDS = ["answer", "ask"] as const;
export type PrepQuestionKind = (typeof PREP_QUESTION_KINDS)[number];

export const PREP_QUESTION_LABELS: Record<PrepQuestionKind, string> = {
  answer: "Questions qu'on va me poser",
  ask: "Questions à poser au recruteur",
};
