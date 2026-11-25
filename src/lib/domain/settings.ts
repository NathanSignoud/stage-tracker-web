export type Profile = {
  /** Pour signer les messages et nommer les lettres exportées. */
  fullName: string;
  email: string;
  phone: string;
  linkedin: string;
  /** Présentation courte (formation, points forts) : transmise à Claude dans les prompts. */
  summary: string;
  /** Ex. « février 2027 ». */
  startDate: string;
  /** Domaines visés, un par ligne ou séparés par des virgules. */
  domains: string;
  skills: string;
  location: string;
};

export type AppSettings = {
  profile: Profile;
  /** Délai de la 1re relance après l'envoi (jours). 0 = pas de relance automatique. */
  followUpDelayDays: number;
  /** Délai de la 2e relance après passage en « Relancée » (jours). 0 = désactivée. */
  secondFollowUpDelayDays: number;
  /** Une candidature en attente est « sans nouvelles » au-delà de ce nombre de jours. */
  staleAfterDays: number;
  /** Objectif de candidatures envoyées par semaine. */
  weeklyGoal: number;
  /** Tâche « Envoyer un remerciement » le lendemain de chaque entretien. */
  thankYouReminder: boolean;
  /** Relance automatique N jours après un entretien sans nouvelles. 0 = désactivée. */
  postInterviewFollowUpDays: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  profile: { fullName: "", email: "", phone: "", linkedin: "", summary: "", startDate: "", domains: "", skills: "", location: "" },
  followUpDelayDays: 10,
  secondFollowUpDelayDays: 7,
  staleAfterDays: 10,
  weeklyGoal: 5,
  thankYouReminder: true,
  postInterviewFollowUpDays: 7,
};
