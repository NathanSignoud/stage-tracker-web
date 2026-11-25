import { describe, expect, it } from "vitest";
import { rows } from "@/lib/db";
import { flashcardOrder } from "@/lib/domain/prep";
import { letterToDocx, letterToPdf } from "@/lib/letter-export";
import { ensureSeed } from "@/lib/seed";
import type { Application, Interaction, Task } from "@/lib/types";
import { changeStatus, createApplication } from "@/services/applications";
import { createContact, linkContact } from "@/services/contacts";
import { createDocument, listApplicationLetters, saveLetterVersion, setBaseDocument } from "@/services/documents";
import { createInteraction } from "@/services/interactions";
import { createKeyword } from "@/services/keywords";
import { recordMessageSent } from "@/services/messages";
import { addDefaultPrepQuestions, addPrepQuestion, getPrep, reviewPrepQuestion, saveCompanyNotes } from "@/services/prep";
import { updateSettings } from "@/services/settings";
import { listTemplates, renderForApplication, resetTemplate, updateTemplate } from "@/services/templates";
import { appInput, at, testUser } from "./helpers";

// Repris de la version locale (tests/templates.test.ts et tests/documents-prep-import.test.ts), sur Postgres + RLS.

describe("gabarits appliqués à une candidature", () => {
  async function setup() {
    await testUser();
    await ensureSeed();
    await updateSettings({
      profile: { fullName: "Alex Martin", email: "alex@example.com", phone: "06 00 00 00 00", linkedin: "", summary: "Élève ingénieur IA", startDate: "février 2027", domains: "NLP", skills: "PyTorch", location: "Paris" },
    });
    await createKeyword({ label: "Kotlin", category: null, aliases: [], mine: false });
    const app = await createApplication(appInput({ company: "Hugging Face", title: "Stage NLP", offerText: "Python, Kotlin et NLP." }), at("2026-10-01"));
    await changeStatus(app, "sent", at("2026-10-02"));
    const contact = await createContact({ name: "Camille Durand", role: "Talent Acquisition", company: "Hugging Face", email: "camille@hf.co", phone: null, linkedin: null, howWeMet: null, notes: null });
    await linkContact(app, contact, "Recruteuse");
    await createInteraction({ applicationId: app, contactId: contact, date: "2026-10-20T10:00", type: "interview", interviewKind: "hr", summary: "Entretien RH", content: "Équipe de 6, projet RAG", location: null, nextAction: null, nextActionDate: null }, at("2026-10-15"));
    await createInteraction({ applicationId: app, contactId: contact, date: "2026-11-05T14:00", type: "interview", interviewKind: "tech", summary: "Entretien technique", content: null, location: null, nextAction: null, nextActionDate: null }, at("2026-10-21"));
    const letter = await createDocument({ kind: "letter", label: "Lettre de base", content: "Madame, Monsieur, …" });
    await setBaseDocument(letter);
    return { app };
  }

  it("10 gabarits livrés (6 prompts, 4 messages)", async () => {
    await setup();
    expect((await listTemplates("prompt"))).toHaveLength(6);
    expect((await listTemplates("message"))).toHaveLength(4);
  });

  it("message de remerciement : dernier entretien passé, contact, signature", async () => {
    const {app } = await setup();
    const msg = await renderForApplication("message", "thank_you", app, at("2026-10-28"));
    expect(msg.subject).toBe("Merci pour notre échange — Stage NLP");
    expect(msg.body).toContain("Bonjour Camille,");
    expect(msg.body).toContain("notre entretien RH du mardi 20 octobre");
    expect(msg.body).toContain("Alex Martin");
    expect(msg.missing).toEqual([]);
  });

  it("prompt de préparation : prochain entretien, compétences, lettre et CV", async () => {
    const {app } = await setup();
    const prompt = await renderForApplication("prompt", "interview_prep", app, at("2026-10-28"));
    expect(prompt.body).toContain("mon entretien technique avec Hugging Face");
    expect(prompt.body).toContain("(prévu le jeudi 5 novembre)");
    // Python et NLP viennent des mots-clés de départ, pas encore cochés « maîtrisés ».
    expect(prompt.body).toContain("(Kotlin, Python, NLP)");
    expect(prompt.body).toContain("Notes — entretien RH du 20 octobre :\nÉquipe de 6, projet RAG");
    expect(prompt.missing).toEqual(["cv_base"]);

    const letterPrompt = await renderForApplication("prompt", "letter", app, at("2026-10-28"));
    expect(letterPrompt.body).toContain("Madame, Monsieur, …");
    expect(letterPrompt.body).toContain("Élève ingénieur IA");
  });

  it("modification puis réinitialisation d'un gabarit", async () => {
    const {app } = await setup();
    const tpl = (await listTemplates("message")).find((t) => t.key === "follow_up")!;
    await updateTemplate(tpl.id, { name: "Relance perso", subject: "Re : {poste}", body: "Coucou {entreprise}" });
    expect((await renderForApplication("message", "follow_up", app)).body).toBe("Coucou Hugging Face");
    await resetTemplate(tpl.id);
    expect((await renderForApplication("message", "follow_up", app)).body).toContain("Je me permets de revenir vers vous");
  });
});

describe("documents de base et versions de lettres", () => {
  it("versions numérotées par candidature", async () => {
    await testUser();
    const app = await createApplication(appInput({ company: "Owkin" }));
    await saveLetterVersion(app, "Version 1", at("2026-11-01"));
    await saveLetterVersion(app, "Version 2", at("2026-11-02"));
    expect((await listApplicationLetters(app)).map((l) => [l.label, l.content])).toEqual([
      ["Lettre — Owkin — v2", "Version 2"],
      ["Lettre — Owkin — v1", "Version 1"],
    ]);
    await expect(saveLetterVersion(app, "   ")).rejects.toThrow(/vide/);
  });
});

describe("préparation d'entretien", () => {
  it("notes, questions classiques sans doublon, révision", async () => {
    await testUser();
    const app = await createApplication(appInput());
    await saveCompanyNotes(app, "Fondée en 2023");
    await addPrepQuestion(app, { kind: "answer", question: "Présentez-vous en deux minutes." });
    const added = await addDefaultPrepQuestions(app);
    expect(added).toBe(15);
    expect(await addDefaultPrepQuestions(app)).toBe(0);

    const { notes, questions } = await getPrep(app);
    expect(notes).toBe("Fondée en 2023");
    const [first, second] = questions;
    await reviewPrepQuestion(first.id, 2, at("2026-11-03"));
    await reviewPrepQuestion(second.id, 0, at("2026-11-03"));
    const order = flashcardOrder((await getPrep(app)).questions);
    expect(order[0].id).not.toBe(first.id);
    expect(order.at(-1)!.id).toBe(first.id);
    expect(order.every((q) => q.kind === "answer")).toBe(true);
  });
});

describe("messages envoyés", () => {
  it("une relance est consignée et fait passer la candidature en Relancée, d'un bloc", async () => {
    await testUser();
    const app = await createApplication(appInput({ company: "Owkin" }), at("2026-10-01"));
    await changeStatus(app, "sent", at("2026-10-01"));
    await recordMessageSent(app, { templateKey: "follow_up", templateName: "Relance", contactId: null, subject: "Candidature", body: "Bonjour" }, at("2026-10-12"));
    const [owkin] = await rows<Application>("applications", { id: app });
    expect(owkin.status).toBe("followed_up");
    expect(await rows<Interaction>("interactions", { applicationId: app })).toMatchObject([
      { type: "email_sent", summary: "Relance", content: "Objet : Candidature\n\nBonjour" },
    ]);
  });

  it("un remerciement coche la tâche « remerciement »", async () => {
    await testUser();
    const app = await createApplication({ ...appInput(), status: "hr_interview" });
    await createInteraction({ applicationId: app, contactId: null, date: "2026-11-04T14:00", type: "interview", interviewKind: "hr", summary: "Entretien RH", content: null, location: null, nextAction: null, nextActionDate: null });
    await recordMessageSent(app, { templateKey: "thank_you", templateName: "Remerciement", contactId: null, body: "Merci" });
    const [thanks] = await rows<Task>("tasks", { applicationId: app, origin: "thank_you" });
    expect(thanks.doneAt).not.toBeNull();
  });
});

describe("export des lettres (navigateur)", () => {
  const LETTER = "Madame, Monsieur,\n\nÉtudiant·e en IA, je candidate… « NLP » — œuvre 100 € ✓\nDeuxième ligne.\n\nCordialement,\nAlex";
  it("DOCX (archive Word) et PDF valides", async () => {
    const docx = new Uint8Array(await (await letterToDocx(LETTER)).arrayBuffer());
    expect(new TextDecoder().decode(docx.slice(0, 2))).toBe("PK");
    const pdf = await letterToPdf(LETTER.repeat(12));
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
