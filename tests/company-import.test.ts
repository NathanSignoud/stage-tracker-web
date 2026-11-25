import { describe, expect, it } from "vitest";
import { cleanUrl, companyKey, parseCompanyList } from "@/lib/domain/company-import";

describe("lecture d'une liste d'entreprises", () => {
  it("tableau Markdown de Claude (gras, liens, colonnes en français)", () => {
    const text = `Voici une sélection :

| Entreprise | Site carrière | Localisation | Secteur | Pourquoi |
|---|---|---|---|---|
| **Mistral AI** | [Carrières](https://mistral.ai/careers) | Paris | IA générative | LLM open source |
| Hugging Face | https://apply.workable.com/huggingface/ | Paris / Remote | NLP | — |
| Owkin | owkin.com/careers | Paris, Nantes | Santé | IA médicale |`;
    const parsed = parseCompanyList(text);
    expect(parsed.format).toBe("markdown");
    expect(parsed.columns).toEqual({ name: "Entreprise", careersUrl: "Site carrière", location: "Localisation", sector: "Secteur", notes: "Pourquoi" });
    expect(parsed.rows).toEqual([
      { name: "Mistral AI", careersUrl: "https://mistral.ai/careers", location: "Paris", sector: "IA générative", notes: "LLM open source" },
      { name: "Hugging Face", careersUrl: "https://apply.workable.com/huggingface/", location: "Paris / Remote", sector: "NLP", notes: null },
      { name: "Owkin", careersUrl: "https://owkin.com/careers", location: "Paris, Nantes", sector: "Santé", notes: "IA médicale" },
    ]);
  });

  it("CSV au point-virgule (format du prompt), guillemets et retours à la ligne", () => {
    const text = `\`\`\`csv
entreprise;site_carriere;localisation;secteur;notes
Photoroom;https://jobs.photoroom.com;Paris;Vision;"Édition photo; IA générative"
"Doctolib";https://careers.doctolib.com;"Paris";Santé;"Équipe data
en croissance"
\`\`\``;
    const parsed = parseCompanyList(text);
    expect(parsed.format).toBe("csv");
    expect(parsed.rows.map((r) => [r.name, r.notes])).toEqual([
      ["Photoroom", "Édition photo; IA générative"],
      ["Doctolib", "Équipe data en croissance"],
    ]);
  });

  it("copie depuis un tableur (TSV), en-têtes anglais, site carrière préféré au site web", () => {
    const text = "Company\tWebsite\tCareers page\tCity\nDataiku\thttps://www.dataiku.com\thttps://www.dataiku.com/careers/\tParis";
    const parsed = parseCompanyList(text);
    expect(parsed.format).toBe("tsv");
    expect(parsed.rows).toEqual([{ name: "Dataiku", careersUrl: "https://www.dataiku.com/careers/", location: "Paris", sector: null, notes: null }]);
  });

  it("JSON (éventuellement entouré de ```json)", () => {
    const text = '```json\n{"entreprises": [{"nom": "Alan", "url": "https://alan.com/careers", "ville": "Paris"}]}\n```';
    expect(parseCompanyList(text)).toMatchObject({
      format: "json",
      rows: [{ name: "Alan", careersUrl: "https://alan.com/careers", location: "Paris" }],
    });
  });

  it("liste à puces", () => {
    const text = `1. **Mistral AI** (Paris) — https://mistral.ai/careers — LLM open source
- Hugging Face — Paris — https://apply.workable.com/huggingface
- Criteo : criteo.com/careers`;
    expect(parseCompanyList(text).rows).toEqual([
      { name: "Mistral AI", careersUrl: "https://mistral.ai/careers", location: "Paris", sector: null, notes: "LLM open source" },
      { name: "Hugging Face", careersUrl: "https://apply.workable.com/huggingface", location: "Paris", sector: null, notes: null },
      { name: "Criteo", careersUrl: "https://criteo.com/careers", location: null, sector: null, notes: null },
    ]);
  });

  it("sans en-tête : la colonne d'URL est reconnue", () => {
    const parsed = parseCompanyList("Mistral AI;https://mistral.ai/careers;Paris\nOwkin;https://owkin.com/careers;Nantes");
    expect(parsed.rows.map((r) => [r.name, r.careersUrl, r.location])).toEqual([
      ["Mistral AI", "https://mistral.ai/careers", "Paris"],
      ["Owkin", "https://owkin.com/careers", "Nantes"],
    ]);
  });

  it("fusionne les doublons et signale les lignes sans nom", () => {
    const parsed = parseCompanyList("entreprise;site_carriere;localisation\nMistral AI;;Paris\nmistral-ai;https://mistral.ai/careers;\n;https://x.com;Lyon");
    expect(parsed.rows).toEqual([{ name: "Mistral AI", careersUrl: "https://mistral.ai/careers", location: "Paris", sector: null, notes: null }]);
    expect(parsed.skipped.map((s) => [s.line, s.reason])).toEqual([
      [3, "doublon de « Mistral AI » (fusionné)"],
      [4, "nom d'entreprise manquant"],
    ]);
  });

  it("normalise noms et URLs", () => {
    expect(companyKey("Hugging-Face")).toBe(companyKey("hugging face"));
    expect(cleanUrl("www.alan.com/careers.")).toBe("https://www.alan.com/careers");
    expect(cleanUrl("[Jobs](https://jobs.lever.co/mistral)")).toBe("https://jobs.lever.co/mistral");
    expect(cleanUrl("pas une url")).toBeNull();
    // Sert aussi à filtrer les liens saisis (offre, LinkedIn) : jamais de javascript: ni data: dans un href.
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(cleanUrl("linkedin.com/in/alex")).toBe("https://linkedin.com/in/alex");
  });
});
