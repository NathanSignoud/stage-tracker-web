import { describe, expect, it } from "vitest";
import { row as readRow } from "@/lib/db";
import type { Application } from "@/lib/types";
import { createApplication, listApplications } from "@/services/applications";
import { createApplicationFromCompany, createCompany, importCompanies, listCompanies } from "@/services/companies";
import { createContact } from "@/services/contacts";
import { appInput, at, testUser } from "./helpers";

// Repris de la version locale (tests/companies.test.ts, partie services).

describe("liste d'entreprises", () => {
  const row = (name: string, extra: Partial<{ careersUrl: string; location: string; sector: string; notes: string }> = {}) => ({
    name,
    careersUrl: null,
    location: null,
    sector: null,
    notes: null,
    ...extra,
  });

  it("import : pas de doublon, champs vides complétés", async () => {
    await testUser();
    await createCompany({ ...row("Mistral AI", { location: "Paris" }), status: "interesting" });
    const report = await importCompanies([
      row("mistral ai", { careersUrl: "https://mistral.ai/careers", location: "Lyon" }),
      row("Owkin", { location: "Nantes" }),
      row("Owkin"),
    ]);
    expect(report).toEqual({ created: 1, completed: 1, unchanged: 1, applicationsCreated: 0 });
    const list = await listCompanies();
    expect(list.map((c) => [c.name, c.careersUrl, c.location, c.status])).toEqual([
      ["Mistral AI", "https://mistral.ai/careers", "Paris", "interesting"],
      ["Owkin", null, "Nantes", "to_explore"],
    ]);
  });

  it("option : une candidature « À explorer » par entreprise sans candidature", async () => {
    await testUser();
    await createApplication(appInput({ company: "Hugging Face" }));
    const report = await importCompanies(
      [row("Hugging Face"), row("Photoroom", { careersUrl: "https://jobs.photoroom.com", location: "Paris", notes: "Vision" })],
      { createApplications: true },
      at("2026-11-09"),
    );
    expect(report.applicationsCreated).toBe(1);
    const photoroom = (await listApplications()).find((a) => a.company === "Photoroom")!;
    // La liste ne transporte pas les notes (longs textes) : on relit la candidature elle-même.
    expect(await readRow<Application>("applications", { id: photoroom.id })).toMatchObject({ status: "to_explore", offerUrl: "https://jobs.photoroom.com", location: "Paris", source: "career_site", notes: "Vision" });
  });

  it("candidatures et contacts rapprochés par le nom ; « Candidater » depuis la liste", async () => {
    await testUser();
    const id = await createCompany(row("Hugging Face", { careersUrl: "https://hf.co/jobs" }));
    await createContact({ name: "Camille", role: null, company: "hugging-face", email: null, phone: null, linkedin: null, howWeMet: null, notes: null });
    expect((await listCompanies())[0]).toMatchObject({ applications: [], contactCount: 1 });
    const appId = await createApplicationFromCompany(id);
    expect((await listCompanies())[0].applications).toEqual([{ id: appId, status: "to_explore" }]);
    await expect(createCompany(row("HUGGING FACE"))).rejects.toThrow(/déjà dans ta liste/);
  });

});
