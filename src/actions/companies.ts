import { z } from "zod";
import { COMPANY_STATUSES } from "@/lib/domain/constants";
import { cleanUrl } from "@/lib/domain/company-import";
import { createApplicationFromCompany, createCompany, importCompanies, updateCompany } from "@/services/companies";
import { renderGlobalPrompt, type RenderedTemplate } from "@/services/templates";
import { errorMessage, mutate, type ActionResult } from "./result";

const id = z.coerce.number().int().positive();
const optional = z
  .string()
  .nullish()
  .transform((v) => (v?.trim() ? v.trim() : null));

const companySchema = z.object({
  name: z.string().trim().min(1, "Le nom de l'entreprise est obligatoire").max(200),
  careersUrl: z
    .string()
    .nullish()
    .transform((v) => cleanUrl(v)),
  location: optional,
  sector: optional,
  notes: optional,
});

export async function importCompaniesAction(rows: unknown, options: { createApplications?: boolean } = {}) {
  return mutate(() =>
    importCompanies(z.array(companySchema).max(500, "500 entreprises maximum par import").parse(rows), {
      createApplications: z.boolean().optional().parse(options.createApplications),
    }),
  );
}

export async function createCompanyAction(input: unknown) {
  return mutate(() => createCompany(companySchema.extend({ status: z.enum(COMPANY_STATUSES).default("to_explore") }).parse(input)));
}

export async function updateCompanyAction(companyId: number, input: unknown) {
  return mutate(() => updateCompany(id.parse(companyId), companySchema.partial().parse(input)));
}

export async function setCompanyStatusAction(companyId: number, status: string) {
  return mutate(() => updateCompany(id.parse(companyId), { status: z.enum(COMPANY_STATUSES).parse(status) }));
}

export async function createApplicationFromCompanyAction(companyId: number) {
  return mutate(() => createApplicationFromCompany(id.parse(companyId)));
}

export async function companyResearchPromptAction(): Promise<ActionResult<RenderedTemplate>> {
  try {
    return { ok: true, data: await renderGlobalPrompt("company_research") };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
