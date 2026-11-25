import type { TemplateKind } from "./constants";

// Gabarits livrés avec l'app (insérés au premier démarrage, modifiables dans Réglages → Gabarits,
// « Réinitialiser » revient à ces versions). Formulations neutres : à personnaliser au besoin.

export type DefaultTemplate = { kind: TemplateKind; key: string; name: string; subject?: string; body: string };

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  // --- Prompts à coller dans Claude --------------------------------------------
  {
    kind: "prompt",
    key: "company_research",
    name: "Recherche d'entreprises",
    body: `Aide-moi à repérer des entreprises où candidater pour mon stage de fin d'études (6 mois).

Propose 20 entreprises qui correspondent à mon profil ci-dessous : startups, scale-ups, grands groupes et labos de R&D, en variant les tailles et les secteurs. Privilégie celles qui recrutent réellement des stagiaires dans mes domaines et dans ma zone géographique.

Règles :
- N'invente pas d'adresse : si tu n'es pas sûr de l'URL exacte de la page carrière, donne le site principal de l'entreprise. Vérifie sur le web si tu y as accès.
- Exclus les entreprises déjà dans ma liste : {entreprises_connues}.

Réponds UNIQUEMENT avec un tableau CSV (séparateur point-virgule), sans aucun texte autour, avec exactement cette ligne d'en-tête :
entreprise;site_carriere;localisation;secteur;notes

- site_carriere : URL complète (https://…) de la page carrières ou des offres
- localisation : ville(s) des bureaux en France, ou « Remote »
- notes : en une phrase, pourquoi cette entreprise correspond à mon profil

<profil>
{profil}
</profil>`,
  },
  {
    kind: "prompt",
    key: "letter",
    name: "Lettre de motivation",
    body: `Aide-moi à adapter ma lettre de motivation pour une candidature de stage de fin d'études (6 mois).

Règles impératives :
- N'invente AUCUNE expérience, compétence, technologie, chiffre ou résultat absent de ma lettre de base, de mon CV ou de mon profil ci-dessous.
- Mets en avant ce qui, dans mon parcours, répond à l'offre, en particulier ces compétences demandées que je maîtrise : {mots_cles_trouves}.
- Ne prétends pas maîtriser : {mots_cles_manquants}. Si c'est pertinent, montre plutôt ma capacité à apprendre vite.
- Garde mon ton et ma structure ; français soigné, sans formules creuses ; une page maximum.
- Réponds uniquement avec la lettre finale, prête à envoyer.

<entreprise>{entreprise}</entreprise>
<poste>{poste}</poste>

<offre>
{texte_offre}
</offre>

<profil>
{profil}
</profil>

<lettre_de_base>
{lettre_base}
</lettre_de_base>

<cv>
{cv_base}
</cv>`,
  },
  {
    kind: "prompt",
    key: "follow_up",
    name: "Email de relance",
    body: `Rédige un email de relance court et professionnel pour ma candidature de stage.

Contexte : candidature envoyée à {entreprise} pour le poste « {poste} » le {date_envoi}, sans réponse à ce jour. Destinataire : {contact}.

Règles : 5 à 7 phrases maximum ; poli sans être insistant ; rappelle en une phrase ce que j'apporte, en t'appuyant uniquement sur mon profil ; propose un court échange ; n'invente rien. Donne l'objet puis le corps de l'email, signé {mon_nom}.

<profil>
{profil}
</profil>

<historique>
{historique}
</historique>`,
  },
  {
    kind: "prompt",
    key: "thank_you",
    name: "Remerciement après entretien",
    body: `Rédige un email de remerciement à envoyer après mon {type_entretien} du {date_entretien} avec {entreprise} (poste « {poste} »). Destinataire : {contact}.

Règles : chaleureux et sobre, 5 à 8 phrases ; reprends un ou deux points concrets tirés de mes notes ; réaffirme ma motivation sans en faire trop ; n'invente aucun détail de l'entretien absent de mes notes. Donne l'objet puis le corps de l'email, signé {mon_nom}.

<mes_notes>
{notes}
</mes_notes>

<historique>
{historique}
</historique>`,
  },
  {
    kind: "prompt",
    key: "linkedin",
    name: "Message LinkedIn",
    body: `Rédige une note d'invitation LinkedIn de 300 caractères maximum (espaces compris) pour {contact}, chez {entreprise}, en lien avec le stage « {poste} ».

Objectif : obtenir un court échange sur l'équipe et le stage. Ton naturel, sans flatterie ni demande directe de recommandation. N'invente rien sur moi en dehors de mon profil. Propose 2 variantes.

<profil>
{profil}
</profil>`,
  },
  {
    kind: "prompt",
    key: "interview_prep",
    name: "Préparation d'entretien",
    body: `Aide-moi à préparer mon {type_entretien} avec {entreprise} pour le stage « {poste} » (prévu le {date_entretien}).

1. Résume en 5 points ce que l'offre attend vraiment.
2. Liste 10 questions probables (RH et techniques), adaptées à l'offre et à mon profil, avec pour chacune les éléments de MON parcours à mobiliser (uniquement ceux présents ci-dessous).
3. Identifie mes points faibles par rapport à l'offre ({mots_cles_manquants}) et comment les aborder honnêtement.
4. Propose 5 questions pertinentes à poser au recruteur.

<offre>
{texte_offre}
</offre>

<profil>
{profil}
</profil>

<cv>
{cv_base}
</cv>

<mes_notes>
{notes}
</mes_notes>`,
  },

  // --- Messages prêts à envoyer ---------------------------------------------------
  {
    kind: "message",
    key: "follow_up",
    name: "Relance après candidature",
    subject: "Candidature — {poste}",
    body: `Bonjour {contact_prenom},

Je me permets de revenir vers vous au sujet de ma candidature au poste « {poste} », envoyée le {date_envoi}.

Ce stage correspond pleinement à mon projet de fin d'études, et la perspective de rejoindre {entreprise} me motive particulièrement. Un échange avec vous serait un plaisir si ma candidature retient votre attention.

Je reste à votre disposition pour tout complément d'information.

Bien cordialement,
{mon_nom}
{mon_telephone}`,
  },
  {
    kind: "message",
    key: "follow_up_interview",
    name: "Relance après entretien",
    subject: "Suite à notre échange — {poste}",
    body: `Bonjour {contact_prenom},

Je me permets de revenir vers vous suite à notre {type_entretien} du {date_entretien} pour le poste « {poste} ».

Auriez-vous des nouvelles concernant la suite du processus ? Mon intérêt pour ce stage et pour {entreprise} reste entier.

Bien cordialement,
{mon_nom}`,
  },
  {
    kind: "message",
    key: "thank_you",
    name: "Remerciement après entretien",
    subject: "Merci pour notre échange — {poste}",
    body: `Bonjour {contact_prenom},

Merci pour le temps que vous m'avez accordé lors de notre {type_entretien} du {date_entretien}.

Cet échange a confirmé mon intérêt pour le poste « {poste} » et pour les projets de {entreprise}.

Je reste disponible pour la suite du processus.

Bien cordialement,
{mon_nom}`,
  },
  {
    kind: "message",
    key: "linkedin",
    name: "Prise de contact LinkedIn",
    body: `Bonjour {contact_prenom}, en dernière année d'école d'ingénieur (IA), je m'intéresse au stage « {poste} » chez {entreprise}. Auriez-vous quelques minutes pour échanger sur l'équipe ? Merci d'avance, {mon_nom}`,
  },
];
