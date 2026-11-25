import { applyPlan, cmp, insert, remove, rows, update, type PlanOp } from "@/lib/db";
import { matchKeywords, type MatchKeyword, type MatchResult } from "@/lib/domain/matching";
import type { Application, Keyword } from "@/lib/types";

export type KeywordInput = { label: string; category: string | null; aliases: string[]; mine: boolean };

export async function listKeywords(): Promise<Keyword[]> {
  return (await rows<Keyword>("keywords")).sort((a, b) => cmp(a.category, b.category) || cmp(a.label, b.label));
}

const toMatch = (k: Pick<Keyword, "id" | "label" | "aliases" | "mine">): MatchKeyword => ({ id: k.id, label: k.label, aliases: k.aliases, mine: k.mine });

export async function analyzeOffer(text: string | null | undefined, keywords?: Keyword[]): Promise<MatchResult | null> {
  if (!text?.trim()) return null;
  return matchKeywords(text, (keywords ?? (await listKeywords())).map(toMatch));
}

export async function scoreOffer(text: string | null | undefined): Promise<number | null> {
  return (await analyzeOffer(text))?.score ?? null;
}

/** Après une modification de la liste (ou de « je maîtrise »), tous les scores sont recalculés (même écriture groupée). */
async function recomputeOps(list: MatchKeyword[]): Promise<PlanOp[]> {
  return (await rows<Pick<Application, "id" | "offerText">>("applications", { deletedAt: null }, ["id", "offerText"])).map((app) =>
    update("applications", { id: app.id }, { matchScore: app.offerText?.trim() ? matchKeywords(app.offerText, list).score : null }),
  );
}

function cleanAliases(aliases: string[]): string[] {
  return [...new Set(aliases.map((a) => a.trim()).filter(Boolean))];
}

export async function createKeyword(input: KeywordInput): Promise<number> {
  const label = input.label.trim();
  const list = await listKeywords();
  const exists = list.find((k) => k.label.toLowerCase() === label.toLowerCase());
  if (exists) throw new Error(`« ${exists.label} » est déjà dans la liste`);
  const values = { label, category: input.category?.trim() || null, aliases: cleanAliases(input.aliases), mine: input.mine };
  const ids = await applyPlan([
    insert("keywords", values),
    ...(await recomputeOps([...list.map(toMatch), toMatch({ id: -1, ...values })])),
  ]);
  return ids[0]!;
}

export async function updateKeyword(id: number, patch: Partial<KeywordInput>): Promise<void> {
  const values = {
    ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
    ...(patch.category !== undefined ? { category: patch.category?.trim() || null } : {}),
    ...(patch.aliases !== undefined ? { aliases: cleanAliases(patch.aliases) } : {}),
    ...(patch.mine !== undefined ? { mine: patch.mine } : {}),
  };
  const list = (await listKeywords()).map((k) => (k.id === id ? { ...k, ...values } : k));
  await applyPlan([update("keywords", { id }, values), ...(await recomputeOps(list.map(toMatch)))]);
}

export async function deleteKeyword(id: number): Promise<void> {
  const list = (await listKeywords()).filter((k) => k.id !== id);
  await applyPlan([remove("keywords", { id }), ...(await recomputeOps(list.map(toMatch)))]);
}
