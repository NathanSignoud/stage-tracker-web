// Scénario d'interface 3c (Réglages, recherche, prompts, messages, lettre, préparation, corbeille) :
// même mode d'emploi que candidatures.mjs.
import { chromium } from "playwright-core";

const SP = process.argv[2] ?? ".";
const base = "http://localhost:5199/tests/e2e/local.html";
const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !/script tag|404/.test(m.text()) && errors.push(m.text()));
const step = async (name, fn) => {
  try {
    await fn();
    console.log("OK  ", name);
  } catch (e) {
    console.log("FAIL", name, "→", e.message.split("\n")[0]);
    await page.screenshot({ path: `${SP}/fail-${name.replace(/\W+/g, "_")}.png`, fullPage: true });
  }
};
const q = (sql, params = []) => page.evaluate(([s, p]) => window.db.query(s, p).then((r) => r.rows), [sql, params]);
const goto = (label) => page.getByRole("navigation").first().getByRole("link", { name: label }).click();
const more = async (label) => {
  await page.getByRole("button", { name: /Plus : réglages/ }).click();
  await page.getByRole("menuitem", { name: label }).click();
};
const mobileOk = async (label) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const w = await page.evaluate(() => window.innerWidth);
  await page.screenshot({ path: `${SP}/3c-mobile-${label}.png`, fullPage: true });
  await page.setViewportSize({ width: 1400, height: 900 });
  if (w !== 390) throw new Error(`innerWidth=${w} sur ${label}`);
};
const download = async (click) => {
  const [d] = await Promise.all([page.waitForEvent("download"), click()]);
  return d.suggestedFilename();
};
const trashFromFiche = async (company) => {
  await goto("Candidatures");
  await page.getByText(company).first().click();
  await page.getByRole("button", { name: "Supprimer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Supprimer|Mettre/ }).click();
  await page.getByRole("heading", { name: "Candidatures" }).waitFor();
};

await page.goto(`${base}#/`);
await page.getByRole("heading", { name: /Aujourd'hui|Bonjour/ }).waitFor({ timeout: 20000 });
await q("select public.apply_plan($1::jsonb)", [
  JSON.stringify([
    { table: "applications", op: "insert", values: { company: "Mistral AI", title: "Stage LLM", status: "sent", sent_date: "2026-11-10", offer_text: "Python, PyTorch, LLM, Kubernetes" } },
    { table: "tasks", op: "insert", values: { title: "Relancer Mistral AI", due_date: "2026-11-20", application_id: { $ref: 0 }, origin: "auto_followup" } },
    { table: "applications", op: "insert", values: { company: "Owkin", status: "to_explore" } },
  ]),
]);

await step("Réglages : profil enregistré", async () => {
  await more("Réglages");
  await page.getByLabel("Nom complet").fill("Alex Martin");
  await page.getByRole("button", { name: "Enregistrer" }).first().click();
  await page.waitForTimeout(500);
  const [s] = await q("select value from settings where key = 'profile'");
  if (s?.value?.fullName !== "Alex Martin") throw new Error(JSON.stringify(s));
});
await step("Réglages : téléphone", () => mobileOk("settings"));
await step("Réglages : mots-clés, ajout", async () => {
  await page.getByRole("link", { name: "Mots-clés" }).click();
  await page.getByPlaceholder(/Ex\. Hugging/).fill("Kotlin");
  await page.getByPlaceholder(/Ex\. Hugging/).press("Enter");
  await page.getByText("Kotlin").first().waitFor();
});
await step("Réglages : gabarits affichés", async () => {
  await page.getByRole("link", { name: "Gabarits" }).click();
  await page.getByLabel("Texte").first().waitFor();
});
await step("Réglages : télécharger mes données", async () => {
  await page.getByRole("link", { name: "Mes données" }).click();
  const name = await download(() => page.getByRole("button", { name: /Télécharger mes données/ }).click());
  if (!/^stage-tracker-\d{4}-\d\d-\d\d\.json$/.test(name)) throw new Error(name);
});

await step("Recherche Ctrl+K → fiche", async () => {
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog").getByRole("combobox").fill("mistral");
  await page.getByRole("dialog").getByText("Mistral AI").first().click();
  await page.getByRole("heading", { name: "Mistral AI" }).waitFor();
});
await step("Fiche : prompt pour Claude", async () => {
  await page.getByRole("button", { name: /Prompt pour Claude/ }).click();
  await page.getByRole("menuitem").first().click();
  const box = page.getByRole("dialog").locator("textarea").first();
  await box.waitFor();
  const text = await box.inputValue();
  if (!text.includes("Mistral AI")) throw new Error(text.slice(0, 120));
  await page.keyboard.press("Escape");
});
await step("Fiche : message de relance marqué envoyé", async () => {
  await page.getByRole("button", { name: /Rédiger|Message/ }).first().click();
  await page.getByRole("dialog").getByText("Rédiger un message").waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Marquer comme envoyé" }).click();
  await page.waitForTimeout(800);
  const [a] = await q("select status from applications where company = 'Mistral AI'");
  if (a.status !== "followed_up") throw new Error(a.status);
});
await page.screenshot({ path: `${SP}/3c-fiche.png`, fullPage: true });
await step("Lettre : nouvelle version et exports", async () => {
  await page.getByRole("link", { name: "Lettre" }).click();
  await page.getByPlaceholder(/Colle ici la version finale/).fill("Madame, Monsieur,\n\nJe candidate au stage LLM — « NLP ».\n\nCordialement,\nAlex");
  await page.getByRole("button", { name: /Enregistrer comme nouvelle version/ }).click();
  await page.getByText("Lettre — Mistral AI — v1").first().waitFor();
  const docx = await download(() => page.getByRole("button", { name: "DOCX" }).click());
  const pdf = await download(() => page.getByRole("button", { name: "PDF" }).click());
  if (!docx.endsWith(".docx") || !pdf.endsWith(".pdf")) throw new Error(`${docx} ${pdf}`);
});
await step("Lettre : téléphone", () => mobileOk("letter"));
await step("Préparation : questions classiques", async () => {
  await page.getByRole("link", { name: "Mistral AI" }).first().click();
  await page.getByRole("link", { name: /Préparer l.entretien/ }).click();
  await page.getByRole("button", { name: /Ajouter les questions classiques/ }).click();
  await page.waitForTimeout(800);
  const [n] = await q("select count(*)::int n from prep_questions");
  if (n.n < 10) throw new Error(`questions=${n.n}`);
});
await page.screenshot({ path: `${SP}/3c-prep.png`, fullPage: true });
await step("Préparation : téléphone", () => mobileOk("prep"));

await step("Corbeille : mettre, restaurer, supprimer définitivement", async () => {
  await trashFromFiche("Owkin");
  await more("Corbeille");
  await page.getByText("Owkin").waitFor();
  await page.getByRole("button", { name: "Restaurer" }).click();
  await page.getByText("La corbeille est vide.").waitFor();
  await trashFromFiche("Owkin");
  await more("Corbeille");
  await page.getByRole("button", { name: "Supprimer" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer définitivement" }).click();
  await page.getByText("La corbeille est vide.").waitFor();
  const [n] = await q("select count(*)::int n from applications where company = 'Owkin'");
  if (n.n !== 0) throw new Error("toujours là");
});
await step("Corbeille : téléphone", () => mobileOk("trash"));
console.log("erreurs:", errors.slice(0, 8));
await browser.close();
