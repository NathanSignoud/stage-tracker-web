// Scénario d'interface « Candidatures » sur la page d'essai locale (tests/e2e/local.html, base PGlite en mémoire).
// Lancer : npx vite --port 5199 --strictPort, puis copier ce fichier dans un dossier où playwright-core est installé
// (npm install --no-save playwright-core@1) et : node candidatures.mjs <dossier des captures>
import { chromium } from "playwright-core";
const SP = process.argv[2] ?? ".";
const base = "http://localhost:5199/tests/e2e/local.html";
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !/script tag|404/.test(m.text()) && errors.push(m.text()));
const step = async (name, fn) => {
  try { await fn(); console.log("OK  ", name); }
  catch (e) { console.log("FAIL", name, "→", e.message.split("\n")[0]); await page.screenshot({ path: `${SP}/fail-${name.replace(/\W+/g, "_")}.png`, fullPage: true }); }
};
const q = (sql) => page.evaluate((s) => window.db.query(s).then((r) => r.rows), sql);

await page.goto(`${base}#/candidatures`);
await page.getByRole("heading", { name: "Candidatures" }).waitFor({ timeout: 20000 });
await step("données de départ créées", async () => {
  const [k] = await q("select count(*)::int n from keywords"); const [t] = await q("select count(*)::int n from templates");
  if (k.n !== 46 || t.n !== 10) throw new Error(`keywords=${k.n} templates=${t.n}`);
});
await step("création complète avec tags et texte d'offre", async () => {
  await page.getByRole("button", { name: "Candidature complète" }).click();
  await page.getByLabel("Entreprise *").fill("Hugging Face");
  await page.getByLabel("Intitulé du poste").fill("Stage NLP");
  await page.locator("#app-tags").fill("NLP");
  await page.locator("#app-tags").press("Enter");
  await page.getByLabel("Texte complet de l'offre (copié-collé)").fill("Python, PyTorch et Kubernetes requis. Expérience en NLP.");
  await page.getByRole("button", { name: "Créer" }).click();
  await page.getByRole("heading", { name: "Hugging Face" }).waitFor();
});
await step("score et analyse de l'offre", async () => {
  await page.getByText("Analyse de l'offre").waitFor();
  const [a] = await q("select match_score from applications where company = 'Hugging Face'");
  if (a.match_score == null) throw new Error("score absent");
});
await step("statut → Envoyée crée la relance", async () => {
  await page.getByRole("combobox").filter({ hasText: "À explorer" }).click();
  await page.getByRole("option", { name: "Envoyée" }).click();
  await page.getByText("Relancer Hugging Face").waitFor();
});
await step("statut → Entretien RH demande la date", async () => {
  await page.getByRole("combobox").filter({ hasText: "Envoyée" }).click();
  await page.getByRole("option", { name: "Entretien RH" }).click();
  await page.getByRole("dialog").getByText(/Planifier l.entretien/).waitFor();
  await page.getByLabel("Date *").fill("2026-12-03");
  await page.getByLabel("Heure *").fill("14:30");
  await page.getByRole("dialog").getByRole("button", { name: /Planifier|Enregistrer|Ajouter/ }).last().click();
  await page.getByText("Envoyer un remerciement à Hugging Face").waitFor();
});
await page.screenshot({ path: `${SP}/3a-fiche-entretien.png`, fullPage: true });
await step("tableau", async () => {
  await page.getByRole("link", { name: "Candidatures" }).first().click();
  await page.getByRole("link", { name: "Tableau" }).click();
  await page.getByRole("cell", { name: /Hugging Face/ }).first().waitFor();
});
await page.screenshot({ path: `${SP}/3a-tableau.png` });
await step("corbeille depuis la fiche", async () => {
  await page.getByRole("cell", { name: /Hugging Face/ }).first().click();
  await page.getByRole("button", { name: "Supprimer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Supprimer|Mettre/ }).click();
  await page.getByRole("heading", { name: "Candidatures" }).waitFor();
  const [a] = await q("select deleted_at from applications where company = 'Hugging Face'");
  if (!a.deleted_at) throw new Error("pas à la corbeille");
});
await step("téléphone : pas de débordement", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText("Mistral AI").first().waitFor().catch(() => {});
  const w = await page.evaluate(() => window.innerWidth);
  if (w !== 390) throw new Error(`innerWidth=${w}`);
});
await page.screenshot({ path: `${SP}/3a-mobile.png` });
console.log("erreurs:", errors.slice(0, 8));
await browser.close();
