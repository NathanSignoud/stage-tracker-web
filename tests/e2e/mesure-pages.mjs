// Mesure, page par page, ce que le site lirait chez Supabase (nombre de requêtes, volume JSON) avec un volume
// réaliste : 40 candidatures avec texte d'offre, historique, tâches, échanges, entreprises, documents.
// Même mode d'emploi que candidatures.mjs. Sert à suivre l'effet des optimisations.
import { chromium } from "playwright-core";

const base = "http://localhost:5199/tests/e2e/local.html";
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`${base}#/taches`);
await page.getByRole("heading", { name: "Tâches" }).waitFor({ timeout: 20000 });

const offer = "Mission : concevoir des modèles de NLP, Python, PyTorch, Kubernetes. ".repeat(60); // ≈ 4 Ko
const ops = [];
for (let i = 0; i < 40; i++) {
  const app = ops.length;
  ops.push({ table: "applications", op: "insert", values: { company: `Entreprise ${i}`, title: "Stage IA", status: ["sent", "to_explore", "hr_interview", "rejected"][i % 4], sent_date: "2026-11-10", offer_text: offer, notes: "Notes ".repeat(30) } });
  for (let s = 0; s < 4; s++) ops.push({ table: "status_changes", op: "insert", values: { application_id: { $ref: app }, to_status: "sent", changed_at: "2026-11-10T10:00:00.000Z" } });
  for (let t = 0; t < 2; t++) ops.push({ table: "tasks", op: "insert", values: { title: `Relancer ${i}`, due_date: "2026-11-30", application_id: { $ref: app }, origin: "auto_followup" } });
  if (i % 3 === 0) ops.push({ table: "interactions", op: "insert", values: { application_id: { $ref: app }, date: "2026-12-02T10:00", type: "interview", interview_kind: "hr", summary: "Entretien RH", content: "Compte rendu ".repeat(40) } });
}
for (let c = 0; c < 50; c++) ops.push({ table: "companies", op: "insert", values: { name: `Cible ${c}`, notes: "Pourquoi elle m'intéresse ".repeat(4) } });
for (let c = 0; c < 10; c++) ops.push({ table: "contacts", op: "insert", values: { name: `Contact ${c}`, notes: "Rencontré au forum ".repeat(5) } });
for (let d = 0; d < 6; d++) ops.push({ table: "documents", op: "insert", values: { kind: d % 2 ? "letter" : "cv", label: `Version ${d}`, content: "Texte du CV ou de la lettre. ".repeat(120) } });
await page.evaluate((plan) => window.db.query("select public.apply_plan($1::jsonb)", [JSON.stringify(plan)]), ops);

const measure = async (label, open) => {
  await page.evaluate(() => Object.assign(window.stats, { selects: 0, bytes: 0, byTable: {}, kbByTable: {} }));
  await open();
  await page.waitForTimeout(1200);
  const s = await page.evaluate(() => structuredClone(window.stats));
  const top = Object.entries(s.kbByTable).filter(([, kb]) => kb >= 5).sort((a, b) => b[1] - a[1]).map(([t, kb]) => `${t} ${kb} Ko (×${s.byTable[t]})`).join(", ");
  console.log(`${label.padEnd(22)} ${String(s.selects).padStart(3)} requêtes  ${String(Math.round(s.bytes / 1024)).padStart(4)} Ko   ${top}`);
  return s.bytes;
};
const nav = (label) => () => page.getByRole("navigation").first().getByRole("link", { name: label }).click();

let total = 0;
total += await measure("Aujourd'hui", nav("Aujourd'hui"));
total += await measure("Candidatures", nav("Candidatures"));
total += await measure("Fiche candidature", () => page.getByText("Entreprise 2", { exact: true }).first().click());
total += await measure("Changer de statut", async () => {
  await page.getByRole("combobox").filter({ hasText: "Entretien RH" }).first().click();
  await page.getByRole("option", { name: "Offre reçue" }).click();
});
total += await measure("Entreprises", nav("Entreprises"));
total += await measure("Calendrier", nav("Calendrier"));
total += await measure("Tâches", nav("Tâches"));
total += await measure("Documents", nav("Documents"));
console.log(`Total du parcours : ${Math.round(total / 1024)} Ko`);
await browser.close();
