import { rows } from "@/lib/db";
import type { ApplicationSummary, Contact, Document, InteractionSummary, StatusChange, Task } from "@/lib/types";

// Lectures partagées entre services : toujours la même requête pour une même table, donc un seul téléchargement
// par page grâce au cache de lib/db.ts (les services filtrent ensuite en mémoire). Les longs textes (offre, notes,
// compte rendu d'échange) ne sont lus que là où ils s'affichent (fiche, recherche, exports).

export const APPLICATION_SUMMARY: (keyof ApplicationSummary)[] = [
  "id",
  "company",
  "title",
  "offerUrl",
  "source",
  "location",
  "remote",
  "duration",
  "startDate",
  "stipend",
  "deadline",
  "sentDate",
  "status",
  "priority",
  "matchScore",
  "createdAt",
  "updatedAt",
  "deletedAt",
];

export const INTERACTION_SUMMARY: (keyof InteractionSummary)[] = [
  "id",
  "applicationId",
  "contactId",
  "date",
  "type",
  "summary",
  "location",
  "interviewKind",
  "durationMinutes",
  "nextAction",
  "nextActionDate",
  "createdAt",
  "updatedAt",
  "deletedAt",
];

/** Toutes les candidatures (corbeille comprise), sans texte d'offre ni notes. */
export const allApplications = () => rows<ApplicationSummary>("applications", {}, APPLICATION_SUMMARY);
/** Tous les échanges (corbeille comprise), sans compte rendu. */
export const allInteractions = () => rows<InteractionSummary>("interactions", {}, INTERACTION_SUMMARY);
export const allContacts = () => rows<Contact>("contacts");
export const allTasks = () => rows<Task>("tasks");
/** Historique des statuts : de quoi dater l'activité et les réponses (la fiche relit l'historique complet). */
export const allStatusChanges = () => rows<Pick<StatusChange, "applicationId" | "toStatus" | "changedAt">>("status_changes", {}, ["applicationId", "toStatus", "changedAt"]);
/** Versions de documents hors corbeille, avec leur texte. */
export const liveDocuments = () => rows<Document>("documents", { deletedAt: null });
