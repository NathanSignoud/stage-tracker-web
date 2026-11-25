import { applyPlan, cmp, insert, row, rows, update, type PlanOp } from "@/lib/db";
import type { CompanyStatus } from "@/lib/domain/constants";
import { companyKey, type CompanyRow } from "@/lib/domain/company-import";
import type { Application, Company, Contact } from "@/lib/types";
import { createApplicationOps, NotFoundError } from "./applications";

export type CompanyInput = CompanyRow & { status?: CompanyStatus };

async function liveCompanies(): Promise<Company[]> {
  return (await rows<Company>("companies", { deletedAt: null })).sort((a, b) => cmp(a.name, b.name));
}

/** Entreprises de la liste, avec les candidatures et contacts rapprochés par nom. */
export async function listCompanies() {
  const [companies, apps, people] = await Promise.all([
    liveCompanies(),
    rows<Application>("applications", { deletedAt: null }),
    rows<Contact>("contacts", { deletedAt: null }),
  ]);
  return companies.map((c) => {
    const key = companyKey(c.name);
    return {
      ...c,
      applications: apps.filter((a) => companyKey(a.company) === key).map((a) => ({ id: a.id, status: a.status })),
      contactCount: people.filter((p) => p.company && companyKey(p.company) === key).length,
    };
  });
}

export type CompanyListItem = Awaited<ReturnType<typeof listCompanies>>[number];

/** Noms déjà connus (liste + candidatures) : à exclure d'une nouvelle recherche avec Claude. */
export async function knownCompanyNames(): Promise<string[]> {
  const [companies, apps] = await Promise.all([liveCompanies(), rows<Application>("applications", { deletedAt: null })]);
  const byKey = new Map<string, string>();
  for (const n of [...companies.map((c) => c.name), ...apps.map((a) => a.company)]) if (!byKey.has(companyKey(n))) byKey.set(companyKey(n), n);
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

export type CompanyImportReport = { created: number; completed: number; unchanged: number; applicationsCreated: number };

/** Candidature « À explorer » pré-remplie depuis une entreprise (page carrière, lieu, notes). */
function applicationFromCompany(c: Pick<Company, "name" | "careersUrl" | "location" | "notes" | "status">, now: Date, base: number) {
  return createApplicationOps(
    {
      company: c.name,
      title: "",
      // Pas encore d'offre précise : le lien pointe vers la page carrière.
      offerUrl: c.careersUrl,
      offerText: null,
      source: "career_site",
      location: c.location,
      remote: null,
      duration: null,
      startDate: null,
      stipend: null,
      deadline: null,
      sentDate: null,
      priority: c.status === "interesting" ? 1 : 2,
      notes: c.notes,
      status: "to_explore",
    },
    now,
    base,
  );
}

/**
 * Importe une liste : les entreprises déjà présentes (même nom) ne sont pas dupliquées, seuls leurs
 * champs vides sont complétés. Option : une candidature « À explorer » par entreprise sans candidature.
 * Tout est écrit d'un bloc.
 */
export async function importCompanies(list: CompanyRow[], options: { createApplications?: boolean } = {}, now = new Date()): Promise<CompanyImportReport> {
  const report: CompanyImportReport = { created: 0, completed: 0, unchanged: 0, applicationsCreated: 0 };
  const [companies, apps] = await Promise.all([liveCompanies(), rows<Application>("applications", { deletedAt: null })]);
  const existing = new Map<string, Pick<Company, "name" | "careersUrl" | "location" | "notes" | "status">>(companies.map((c) => [companyKey(c.name), c]));
  const appKeys = new Set(apps.map((a) => companyKey(a.company)));
  const nowIso = now.toISOString();
  const ops: PlanOp[] = [];

  for (const entry of list) {
    const key = companyKey(entry.name);
    if (!key) continue;
    const found = existing.get(key);
    if (found) {
      const patch = Object.fromEntries(
        (["careersUrl", "location", "sector", "notes"] as const).filter((f) => !(found as Partial<Company>)[f] && entry[f]).map((f) => [f, entry[f]]),
      );
      if (Object.keys(patch).length && "id" in found) {
        ops.push(update("companies", { id: found.id }, { ...patch, updatedAt: nowIso }));
        report.completed++;
      } else report.unchanged++;
    } else {
      const created = { ...entry, name: entry.name.trim(), status: "to_explore" as const };
      ops.push(insert("companies", { ...entry, name: created.name, createdAt: nowIso, updatedAt: nowIso }));
      existing.set(key, created);
      report.created++;
    }
    if (options.createApplications && !appKeys.has(key)) {
      ops.push(...(await applicationFromCompany(existing.get(key)!, now, ops.length)));
      appKeys.add(key);
      report.applicationsCreated++;
    }
  }
  await applyPlan(ops);
  return report;
}

/** « Candidater » depuis la liste : candidature « À explorer » pré-remplie (page carrière, lieu, notes). */
export async function createApplicationFromCompany(id: number, now = new Date()): Promise<number> {
  const company = await row<Company>("companies", { id });
  if (!company || company.deletedAt) throw new NotFoundError("Entreprise introuvable");
  return (await applyPlan(await applicationFromCompany(company, now, 0)))[0]!;
}

export async function createCompany(input: CompanyInput, now = new Date()): Promise<number> {
  const key = companyKey(input.name);
  const duplicate = (await liveCompanies()).find((c) => companyKey(c.name) === key);
  if (duplicate) throw new Error(`« ${duplicate.name} » est déjà dans ta liste`);
  const nowIso = now.toISOString();
  return (await applyPlan([insert("companies", { ...input, name: input.name.trim(), createdAt: nowIso, updatedAt: nowIso })]))[0]!;
}

export async function updateCompany(id: number, input: Partial<CompanyInput>, now = new Date()): Promise<void> {
  await applyPlan([update("companies", { id }, { ...input, ...(input.name ? { name: input.name.trim() } : {}), updatedAt: now.toISOString() })]);
}
