import { z } from "zod";
import type { ImportedOffer } from "@/lib/domain/offer-parsing";
import { applyImportedOffer, getLiveApplication, setOfferText } from "@/services/applications";
import { setBaseDocument } from "@/services/documents";
import { createKeyword, deleteKeyword, updateKeyword } from "@/services/keywords";
import { mutate, type ActionResult } from "./result";

const id = z.coerce.number().int().positive();

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
  // shortcut: la lecture d'une page demande un serveur (Edge Function, étape 4) ; d'ici là, message clair.
  void url;
  return { ok: false, error: "L'import depuis le lien arrive bientôt. En attendant, colle le texte de l'offre." };
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
