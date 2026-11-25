// Gabarits de prompts et de messages : variables {nom} remplacées par les données de la candidature.

export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: "entreprise", label: "Nom de l'entreprise" },
  { key: "poste", label: "Intitulé du poste" },
  { key: "contact", label: "Contact principal (nom complet)" },
  { key: "contact_prenom", label: "Prénom du contact" },
  { key: "date_envoi", label: "Date d'envoi de la candidature" },
  { key: "date_entretien", label: "Date du dernier / prochain entretien" },
  { key: "type_entretien", label: "Type de cet entretien (RH, technique…)" },
  { key: "lieu", label: "Lieu du poste" },
  { key: "texte_offre", label: "Texte complet de l'offre" },
  { key: "mots_cles_trouves", label: "Compétences de l'offre que je maîtrise" },
  { key: "mots_cles_manquants", label: "Compétences de l'offre que je ne maîtrise pas" },
  { key: "score", label: "Score de matching (%)" },
  { key: "lettre_base", label: "Ma lettre de motivation de base" },
  { key: "cv_base", label: "Texte de mon CV de base" },
  { key: "profil", label: "Mon profil (domaines, compétences, dates, lieu)" },
  { key: "notes", label: "Mes notes sur la candidature" },
  { key: "historique", label: "Historique des échanges" },
  { key: "mon_nom", label: "Mon nom" },
  { key: "mon_email", label: "Mon email" },
  { key: "mon_telephone", label: "Mon téléphone" },
  { key: "entreprises_connues", label: "Entreprises déjà dans ma liste (prompt de recherche uniquement)" },
];

export type TemplateVars = Record<string, string | null | undefined>;

/**
 * Remplace les {variables}. Une variable connue mais vide devient « [variable] » pour sauter aux
 * yeux avant l'envoi ; une accolade inconnue est laissée telle quelle.
 */
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{([a-z_]+)\}/g, (match, key: string) => {
    if (!(key in vars)) return match;
    const value = vars[key]?.trim();
    return value ? value : `[${key}]`;
  });
}

/** Variables utilisées par un gabarit et restées vides (pour prévenir avant de copier). */
export function missingVariables(body: string, vars: TemplateVars): string[] {
  const used = [...body.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]);
  return [...new Set(used)].filter((key) => key in vars && !vars[key]?.trim());
}

export function mailtoUrl(params: { to?: string | null; subject: string; body: string }): string {
  const query = new URLSearchParams({ subject: params.subject, body: params.body }).toString().replace(/\+/g, "%20");
  return `mailto:${encodeURIComponent(params.to ?? "")}?${query}`;
}
