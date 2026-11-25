// Scénario d'interface de l'étape 4 (fichiers des documents, import d'offre par lien, abonnement agenda) :
// même mode d'emploi que candidatures.mjs. Le serveur (/api/offer) est simulé par Playwright.
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const SP = process.argv[2] ?? ".";
const PROJECT = process.argv[3] ?? "h:/Documents/Projets_INFO/stage-tracker-web";
const require = createRequire(`${PROJECT}/package.json`);
const { Document, Packer, Paragraph } = require("docx");
const { PDFDocument, StandardFonts } = require("pdf-lib");

const docxBytes = Buffer.from(await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph("Lettre Word : PyTorch et NLP")] }] })));
const pdf = await PDFDocument.create();
pdf.addPage().drawText("CV PDF : Python et Kubernetes", { x: 50, y: 700, font: await pdf.embedFont(StandardFonts.Helvetica), size: 14 });
const pdfBytes = Buffer.from(await pdf.save());

const base = "http://localhost:5199/tests/e2e/local.html";
const browser = await chromium.launch({ channel: "msedge" });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true })).newPage();
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
const addVersion = async (label, name, mimeType, buffer) => {
  await page.getByRole("button", { name: "Nouvelle version" }).click();
  await page.getByLabel("Libellé *").fill(label);
  await page.getByLabel("Fichier").setInputFiles({ name, mimeType, buffer });
  await page.getByRole("dialog").getByRole("button", { name: /Enregistrer|Ajouter|Créer/ }).click();
  await page.getByText(label).first().waitFor();
};

// Le serveur transmet la page brute ; le site la lit lui-même.
const offerPage = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@type": "JobPosting",
  title: "Stage Machine Learning",
  hiringOrganization: { name: "Photoroom" },
  jobLocation: { address: { addressLocality: "Paris" } },
  validThrough: "2026-12-15",
  description: "Python, PyTorch",
})}</script></head><body></body></html>`;
await page.route("**/api/offer", (route) =>
  route.fulfill({ body: offerPage, headers: { "content-type": "text/plain; charset=utf-8", "x-offer-url": "https://jobs.photoroom.com/1" } }),
);
await page.goto(`${base}#/documents`);
await page.getByRole("heading", { name: "Documents" }).waitFor({ timeout: 20000 });

await step("Documents : CV en PDF envoyé, texte lu dans le navigateur", async () => {
  await addVersion("CV PDF", "cv.pdf", "application/pdf", pdfBytes);
  const [d] = await q("select content, file_name, file_path from documents where label = 'CV PDF'");
  if (!d.content?.includes("Python et Kubernetes")) throw new Error(`texte : ${d.content}`);
  if (!d.file_path?.endsWith("-cv.pdf")) throw new Error(`chemin : ${d.file_path}`);
});
await step("Documents : lettre Word envoyée, texte lu dans le navigateur", async () => {
  await addVersion("Lettre Word", "lettre.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docxBytes);
  const [d] = await q("select content from documents where label = 'Lettre Word'");
  if (!d.content?.includes("PyTorch et NLP")) throw new Error(`texte : ${d.content}`);
});
await step("Documents : télécharger le fichier", async () => {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Télécharger cv.pdf" }).first().click()]);
  if (download.suggestedFilename() !== "cv.pdf") throw new Error(download.suggestedFilename());
});
await step("Documents : format refusé avec un message clair", async () => {
  await page.getByRole("button", { name: "Nouvelle version" }).click();
  await page.getByLabel("Libellé *").fill("Programme");
  await page.getByLabel("Fichier").setInputFiles({ name: "virus.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });
  await page.getByRole("dialog").getByRole("button", { name: /Enregistrer|Ajouter|Créer/ }).click();
  await page.getByText(/Format non accepté/).first().waitFor();
  await page.keyboard.press("Escape");
});
await step("Corbeille : le fichier part avec le document", async () => {
  const before = await page.evaluate(() => window.stored.size);
  await page.getByRole("row", { name: /CV PDF/ }).getByRole("button", { name: /corbeille/i }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /Supprimer|Mettre/ }).click();
  await page.getByRole("button", { name: /Plus : réglages/ }).click();
  await page.getByRole("menuitem", { name: "Corbeille" }).click();
  await page.getByRole("button", { name: "Supprimer" }).first().click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Supprimer définitivement" }).click();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.stored.size);
  if (after !== before - 1) throw new Error(`fichiers : ${before} → ${after}`);
});

await step("Ajout rapide : « Remplir depuis le lien »", async () => {
  await page.keyboard.press("n");
  await page.getByLabel("Lien de l'offre").fill("https://jobs.photoroom.com/1");
  await page.getByRole("button", { name: /Remplir depuis le lien/ }).click();
  await page.getByText("Offre lue").waitFor();
  if ((await page.getByLabel("Entreprise *").inputValue()) !== "Photoroom") throw new Error("entreprise non remplie");
  if ((await page.getByLabel("Poste").inputValue()) !== "Stage Machine Learning") throw new Error("poste non rempli");
  await page.keyboard.press("Escape");
});

await step("Calendrier : abonnement (lien secret et fuseau enregistrés)", async () => {
  await goto("Calendrier");
  await page.getByRole("button", { name: "Connecter mon agenda" }).click();
  const url = await page.getByLabel("Adresse d'abonnement").inputValue();
  if (!/^http:\/\/localhost:5199\/api\/calendar\/[A-Za-z0-9_-]{24}\.ics$/.test(url)) throw new Error(url);
  const settings = await q("select key, value from settings where key in ('calendarToken', 'calendarTimeZone') order by key");
  if (settings.length !== 2 || !url.includes(settings[1].value)) throw new Error(JSON.stringify(settings));
});
await page.screenshot({ path: `${SP}/etape4-agenda.png` });
await step("Calendrier : régénérer le lien", async () => {
  const before = await page.getByLabel("Adresse d'abonnement").inputValue();
  await page.getByRole("button", { name: "Régénérer le lien" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Régénérer" }).click();
  await page.getByText("Nouveau lien créé").waitFor();
  await page.waitForTimeout(300);
  if ((await page.getByLabel("Adresse d'abonnement").inputValue()) === before) throw new Error("lien inchangé");
});
console.log("erreurs:", errors.slice(0, 8));
await browser.close();
