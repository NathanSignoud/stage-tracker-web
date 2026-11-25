import { applyPlan, cmp, row, rows, update, upsert } from "@/lib/db";
import { formatDay, localDateTime } from "@/lib/dates";
import { INTERACTION_LABELS, INTERVIEW_KIND_LABELS, type TemplateKind } from "@/lib/domain/constants";
import { DEFAULT_TEMPLATES } from "@/lib/domain/default-templates";
import { missingVariables, renderTemplate, type TemplateVars } from "@/lib/domain/templates";
import type { InterviewPrep, Template } from "@/lib/types";
import { getApplicationDetail, NotFoundError } from "./applications";
import { knownCompanyNames } from "./companies";
import { getBaseDocument } from "./documents";
import { analyzeOffer, listKeywords } from "./keywords";
import { getSettings } from "./settings";

export async function listTemplates(kind?: TemplateKind): Promise<Template[]> {
  const list = (await rows<Template>("templates", kind ? { kind } : {})).sort((a, b) => cmp(a.id, b.id));
  return list;
}

/** Insère les gabarits par défaut manquants (sans toucher à ceux déjà personnalisés). */
export async function ensureDefaultTemplates(now = new Date()): Promise<void> {
  await upsert(
    "templates",
    DEFAULT_TEMPLATES.map((t) => ({ kind: t.kind, key: t.key, name: t.name, subject: t.subject ?? null, body: t.body, updatedAt: now.toISOString() })),
    ["userId", "kind", "key"],
    { ignore: true },
  );
}

export async function updateTemplate(id: number, input: { name: string; subject: string | null; body: string }, now = new Date()): Promise<void> {
  await applyPlan([
    update("templates", { id }, { name: input.name.trim(), subject: input.subject?.trim() || null, body: input.body, updatedAt: now.toISOString() }),
  ]);
}

/** Revient au texte livré avec l'app. */
export async function resetTemplate(id: number, now = new Date()): Promise<void> {
  const current = await row<Template>("templates", { id });
  const original = DEFAULT_TEMPLATES.find((t) => t.kind === current?.kind && t.key === current?.key);
  if (!current || !original) throw new NotFoundError("Gabarit introuvable");
  await updateTemplate(id, { name: original.name, subject: original.subject ?? null, body: original.body }, now);
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Profil (Réglages + compétences cochées) tel que transmis à Claude dans {profil}. */
async function profileText(): Promise<string> {
  const [{ profile }, keywords] = await Promise.all([getSettings(), listKeywords()]);
  const myKeywords = keywords.filter((k) => k.mine).map((k) => k.label);
  return [
    profile.summary,
    profile.domains && `Domaines visés : ${profile.domains}`,
    profile.skills && `Compétences clés : ${profile.skills}`,
    myKeywords.length > 0 && `Compétences techniques : ${myKeywords.join(", ")}`,
    profile.startDate && `Début de stage souhaité : ${profile.startDate}`,
    profile.location && `Localisation souhaitée : ${profile.location}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Valeurs des {variables} pour une candidature. `preferUpcoming` : la préparation d'entretien vise
 * le prochain entretien, le remerciement et la relance le dernier entretien passé.
 */
export async function buildTemplateVars(applicationId: number, options: { preferUpcoming?: boolean; now?: Date } = {}): Promise<TemplateVars> {
  const detail = await getApplicationDetail(applicationId);
  if (!detail || detail.application.deletedAt) throw new NotFoundError("Candidature introuvable");
  const app = detail.application;
  const now = localDateTime(options.now);
  const [{ profile }, analysis, prep, profil, baseLetter, baseCv] = await Promise.all([
    getSettings(),
    analyzeOffer(app.offerText),
    row<InterviewPrep>("interview_preps", { applicationId: app.id }),
    profileText(),
    getBaseDocument("letter"),
    getBaseDocument("cv"),
  ]);

  const contact =
    detail.contacts.find((c) => /recrut|rh|talent|manager/i.test(`${c.relation ?? ""} ${c.role ?? ""}`)) ?? detail.contacts[0];
  const interviews = detail.interactions.filter((i) => i.type === "interview").sort((a, b) => a.date.localeCompare(b.date));
  const past = interviews.filter((i) => i.date <= now);
  const upcoming = interviews.filter((i) => i.date > now);
  const interview = options.preferUpcoming ? (upcoming[0] ?? past.at(-1)) : (past.at(-1) ?? upcoming[0]);
  const labels = (hits: { keyword: { label: string } }[]) => hits.map((h) => h.keyword.label).join(", ") || "aucune";

  // Toutes les notes utiles : candidature, chaque entretien (passé ou prévu), fiche de préparation.
  const notes = [
    app.notes && `Notes sur la candidature :\n${app.notes}`,
    ...interviews
      .filter((i) => i.content)
      .map((i) => `Notes — ${lowerFirst(INTERVIEW_KIND_LABELS[i.interviewKind ?? "other"])} du ${formatDay(i.date, "d MMMM")} :\n${i.content}`),
    prep?.companyNotes && `Notes sur l'entreprise :\n${prep.companyNotes}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const historique = detail.interactions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12)
    .map((i) => {
      const label = i.type === "interview" ? INTERVIEW_KIND_LABELS[i.interviewKind ?? "other"] : INTERACTION_LABELS[i.type];
      return `- ${formatDay(i.date, "d MMM yyyy")} · ${label} : ${i.summary}`;
    })
    .join("\n");

  return {
    entreprise: app.company,
    poste: app.title,
    contact: contact?.name,
    contact_prenom: contact?.name.split(/\s+/)[0],
    date_envoi: app.sentDate && formatDay(app.sentDate, "d MMMM yyyy"),
    date_entretien: interview && formatDay(interview.date, "EEEE d MMMM"),
    type_entretien: interview && lowerFirst(INTERVIEW_KIND_LABELS[interview.interviewKind ?? "other"]),
    lieu: app.location,
    texte_offre: app.offerText,
    mots_cles_trouves: analysis && labels(analysis.mine),
    mots_cles_manquants: analysis && labels(analysis.missing),
    score: analysis?.score != null ? `${Math.round(analysis.score * 100)} %` : null,
    lettre_base: baseLetter?.content,
    cv_base: baseCv?.content,
    profil,
    notes,
    historique,
    mon_nom: profile.fullName,
    mon_email: profile.email,
    mon_telephone: profile.phone,
  };
}

export type RenderedTemplate = {
  id: number;
  key: string;
  name: string;
  subject: string | null;
  body: string;
  /** Variables utilisées mais vides : à compléter avant d'envoyer. */
  missing: string[];
};

async function findTemplate(kind: TemplateKind, key: string): Promise<Template> {
  const template = await row<Template>("templates", { kind, key });
  if (!template) throw new NotFoundError("Gabarit introuvable");
  return template;
}

export async function renderForApplication(kind: TemplateKind, key: string, applicationId: number, now = new Date()): Promise<RenderedTemplate> {
  const template = await findTemplate(kind, key);
  const vars = await buildTemplateVars(applicationId, { preferUpcoming: key === "interview_prep", now });
  return {
    id: template.id,
    key: template.key,
    name: template.name,
    subject: template.subject ? renderTemplate(template.subject, vars) : null,
    body: renderTemplate(template.body, vars),
    missing: missingVariables(`${template.subject ?? ""}\n${template.body}`, vars),
  };
}

/** Prompt indépendant d'une candidature (ex. recherche d'entreprises) : profil + entreprises déjà connues. */
export async function renderGlobalPrompt(key: string): Promise<RenderedTemplate> {
  const [template, { profile }, profil, known] = await Promise.all([findTemplate("prompt", key), getSettings(), profileText(), knownCompanyNames()]);
  const vars: TemplateVars = { profil, mon_nom: profile.fullName, entreprises_connues: known.join(", ") || "aucune pour l'instant" };
  return {
    id: template.id,
    key: template.key,
    name: template.name,
    subject: null,
    body: renderTemplate(template.body, vars),
    missing: missingVariables(template.body, vars),
  };
}
