// Scénario d'interface 3b (Aujourd'hui, Calendrier, Tâches, Contacts, Entreprises, Documents) : même mode d'emploi que candidatures.mjs.
import { chromium } from "playwright-core";
const SP = process.argv[2] ?? ".";
const base = "http://localhost:5199/tests/e2e/local.html";
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !/script tag|404/.test(m.text()) && errors.push(m.text()));
const step = async (name, fn) => {
  try { await fn(); console.log("OK  ", name); }
  catch (e) { console.log("FAIL", name, "→", e.message.split("\n")[0]); await page.screenshot({ path: `${SP}/fail-${name.replace(/\W+/g, "_")}.png`, fullPage: true }); }
};
const q = (sql, params = []) => page.evaluate(([s, p]) => window.db.query(s, p).then((r) => r.rows), [sql, params]);
const nav = async (label) => { await page.getByRole("navigation").first().getByRole("link", { name: label }).click(); };
const mobileOk = async (label) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const w = await page.evaluate(() => window.innerWidth);
  await page.screenshot({ path: `${SP}/3b-mobile-${label}.png`, fullPage: true });
  await page.setViewportSize({ width: 1400, height: 900 });
  if (w !== 390) throw new Error(`innerWidth=${w} sur ${label}`);
};

await page.goto(`${base}#/`);
await page.getByRole("heading", { name: /Aujourd'hui|Bonjour/ }).waitFor({ timeout: 20000 });
// Données : une candidature envoyée il y a 15 jours (relance due), un entretien dans 2 jours.
const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
const plus = (n) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
await q("select public.apply_plan($1::jsonb)", [JSON.stringify([
  { table: "applications", op: "insert", values: { company: "Mistral AI", status: "sent", sent_date: plus(-15) } },
  { table: "tasks", op: "insert", values: { title: "Relancer Mistral AI", due_date: plus(-5), application_id: { $ref: 0 }, origin: "auto_followup" } },
  { table: "applications", op: "insert", values: { company: "Photoroom", status: "hr_interview" } },
  { table: "interactions", op: "insert", values: { application_id: { $ref: 2 }, date: `${plus(2)}T10:00`, type: "interview", interview_kind: "hr", summary: "Entretien RH" } },
])]);

await step("Aujourd'hui : relance due et prochain entretien", async () => {
  await nav("Tâches"); await nav("Aujourd'hui");
  await page.getByText("Relancer Mistral AI").first().waitFor();
  await page.getByText("Photoroom").first().waitFor();
});
await page.screenshot({ path: `${SP}/3b-today.png`, fullPage: true });
await step("Aujourd'hui : téléphone", () => mobileOk("today"));

await step("Calendrier : entretien affiché, mois suivant, export .ics", async () => {
  await nav("Calendrier");
  await page.getByText("Photoroom").first().waitFor();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: ".ics" }).click()]);
  if (download.suggestedFilename() !== "stage-tracker.ics") throw new Error(download.suggestedFilename());
  await page.getByRole("link", { name: "Mois suivant" }).click();
  await page.getByRole("link", { name: "Aujourd'hui" }).last().click();
});
await step("Calendrier : téléphone", () => mobileOk("calendar"));

await step("Tâches : ajouter puis cocher", async () => {
  await nav("Tâches");
  await page.getByPlaceholder("Nouvelle tâche…").fill("Mettre à jour mon CV");
  await page.getByPlaceholder("Nouvelle tâche…").press("Enter");
  await page.getByText("Mettre à jour mon CV").waitFor();
  await page.getByRole("checkbox").last().click();
  await page.waitForTimeout(500);
  const [t] = await q("select done_at from tasks where title = 'Mettre à jour mon CV'");
  if (!t?.done_at) throw new Error("non cochée");
});
await step("Tâches : téléphone", () => mobileOk("tasks"));

await step("Contacts : créer, ouvrir la fiche, modifier", async () => {
  await nav("Contacts");
  await page.getByRole("button", { name: "Nouveau contact" }).click();
  await page.getByLabel("Nom *").fill("Camille Martin");
  await page.getByLabel("Entreprise").fill("Mistral AI");
  await page.getByRole("dialog").getByRole("button", { name: /Créer|Enregistrer|Ajouter/ }).click();
  await page.getByRole("heading", { name: "Camille Martin" }).waitFor();
  await page.getByRole("button", { name: "Modifier" }).click();
  await page.getByLabel("Rôle").fill("Talent acquisition");
  await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Talent acquisition · Mistral AI").waitFor();
});
await step("Fiche contact : téléphone", () => mobileOk("contact"));

await step("Entreprises : ajouter et importer une liste (avec candidatures)", async () => {
  await nav("Entreprises");
  await page.getByRole("button", { name: /Importer/ }).first().click();
  await page.getByRole("dialog").locator("textarea").fill("entreprise;site_carriere;localisation;secteur;notes\nOwkin;https://owkin.com/careers;Nantes;Santé;IA médicale\nMistral AI;https://mistral.ai/careers;Paris;LLM;");
  await page.getByRole("dialog").getByRole("checkbox", { name: /candidature/i }).check().catch(() => {});
  await page.getByRole("dialog").getByRole("button", { name: /Importer \d|Importer les|Importer$/ }).last().click();
  await page.getByText("Owkin").first().waitFor();
});
await page.screenshot({ path: `${SP}/3b-companies.png`, fullPage: true });
await step("Entreprises : téléphone", () => mobileOk("companies"));

await step("Documents : nouvelle version texte, version de base", async () => {
  await nav("Documents");
  await page.getByRole("button", { name: "Nouvelle version" }).click();
  await page.getByLabel("Libellé *").fill("CV v1");
  await page.getByLabel(/Texte/).fill("Étudiant en IA, Python, PyTorch.");
  await page.getByRole("dialog").getByRole("button", { name: /Enregistrer|Ajouter|Créer/ }).click();
  await page.getByText("CV v1").first().waitFor();
  await page.getByRole("button", { name: /base/i }).first().click();
  await page.waitForTimeout(500);
  const [d] = await q("select is_base from documents where label = 'CV v1'");
  if (!d?.is_base) throw new Error("pas de base");
});
await step("Documents : téléphone", () => mobileOk("documents"));

await step("Fiche : lier un document envoyé", async () => {
  await nav("Candidatures");
  await page.getByText("Mistral AI").first().click();
  await page.getByRole("button", { name: "Ajouter un document" }).click();
  await page.getByRole("tab", { name: /existante|Version existante|Déjà/ }).click().catch(() => {});
  await page.screenshot({ path: `${SP}/3b-doc-dialog.png` });
});
console.log("erreurs:", errors.slice(0, 8));
await browser.close();
