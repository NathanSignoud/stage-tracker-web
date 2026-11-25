import { describe, expect, it } from "vitest";
import { applyPlan, rows, update } from "@/lib/db";
import { letterToDocx, letterToPdf } from "@/lib/letter-export";
import { setFileStore, type FileStore } from "@/lib/storage";
import { extractDocumentText } from "@/lib/text-extraction";
import type { Document } from "@/lib/types";
import { createApplication } from "@/services/applications";
import { attachDocumentFile, downloadDocumentFile, saveDocument } from "@/services/documents";
import { moveToTrash, purgeFromTrash } from "@/services/trash";
import { appInput, testUser } from "./helpers";

const LETTER = "Madame, Monsieur,\n\nÉtudiant·e en IA, je candidate… « NLP » — œuvre 100 € ✓\nDeuxième ligne.\n\nCordialement,\nAlex";

// Repris de la version locale (tests/documents-prep-import.test.ts) : l'extraction se fait maintenant dans le navigateur.
describe("texte des fichiers envoyés", () => {
  it("DOCX relisible (aller-retour par l'extraction de texte)", async () => {
    const docx = new Uint8Array(await (await letterToDocx(LETTER)).arrayBuffer());
    const text = await extractDocumentText("lettre.docx", docx);
    expect(text).toContain("Étudiant·e en IA, je candidate… « NLP » — œuvre 100 €");
    expect(text).toContain("Cordialement");
  });

  it("PDF : caractères hors police remplacés, texte relu", async () => {
    const text = await extractDocumentText("lettre.pdf", await letterToPdf(LETTER.repeat(12)));
    // « … », « — », « œ », « € » existent dans la police standard ; « ✓ » non → remplacé.
    expect(text).toContain("je candidate… « NLP » — œuvre 100 € ?");
  });

  it("Markdown lu tel quel ; fichier illisible → null (le texte sera collé à la main)", async () => {
    expect(await extractDocumentText("cv.md", new TextEncoder().encode("# CV\r\n\r\n\r\n\r\nPython"))).toBe("# CV\n\nPython");
    expect(await extractDocumentText("cv.pdf", new TextEncoder().encode("pas un pdf"))).toBeNull();
  });
});

/** Stockage en mémoire, à la place de Supabase Storage. */
function memoryStore() {
  const stored = new Map<string, Blob>();
  const store: FileStore = {
    async upload(file, fileName) {
      const path = `moi/${stored.size}-${fileName}`;
      stored.set(path, file);
      return path;
    },
    async download(path) {
      const blob = stored.get(path);
      if (!blob) throw new Error("absent");
      return blob;
    },
    async remove(paths) {
      for (const p of paths) stored.delete(p);
    },
  };
  setFileStore(store);
  return stored;
}

describe("documents avec fichier", () => {
  it("le fichier est rangé, relu, puis supprimé avec le document (corbeille)", async () => {
    await testUser();
    const stored = memoryStore();
    const app = await createApplication(appInput({ company: "Owkin" }));
    const file = new File(["contenu du CV"], "CV Alex.pdf", { type: "application/pdf" });
    const id = await saveDocument({ kind: "cv", label: "CV v1", content: "Python" }, file, { applicationId: app, sentAt: "2026-11-20" });

    const [doc] = await rows<Document>("documents", { id });
    expect(doc).toMatchObject({ fileName: "CV Alex.pdf", mimeType: "application/pdf", filePath: "moi/0-CV Alex.pdf" });
    expect(await (await downloadDocumentFile(doc)).text()).toBe("contenu du CV");

    await moveToTrash("document", id);
    await purgeFromTrash("document", id);
    expect(stored.size).toBe(0);
  });

  it("si l'enregistrement échoue, le fichier envoyé est retiré", async () => {
    await testUser();
    const stored = memoryStore();
    const app = await createApplication(appInput());
    await applyPlan([update("applications", { id: app }, { deletedAt: "2026-11-01T00:00:00.000Z" })]);
    const file = new File(["x"], "lettre.docx");
    // Type de document invalide : la base refuse l'écriture.
    await expect(saveDocument({ kind: "photo" as never, label: "?", content: null }, file, null)).rejects.toThrow();
    expect(stored.size).toBe(0);
  });

  it("refuse un format ou un poids que le stockage refuserait, avant tout envoi", async () => {
    await testUser();
    const stored = memoryStore();
    await expect(saveDocument({ kind: "cv", label: "CV", content: null }, new File(["x"], "cv.exe"), null)).rejects.toThrow(/Format non accepté/);
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "cv.pdf");
    await expect(saveDocument({ kind: "cv", label: "CV", content: null }, big, null)).rejects.toThrow(/10 Mo/);
    expect(stored.size).toBe(0);
  });
});

describe("joindre un fichier à une version existante", () => {
  it("le texte lu est gardé seulement s'il manquait ; remplacer retire l'ancien fichier", async () => {
    await testUser();
    const stored = memoryStore();
    const sansTexte = await saveDocument({ kind: "cv", label: "CV importé", content: null }, null, null);
    const avecTexte = await saveDocument({ kind: "letter", label: "Lettre", content: "Mon texte" }, null, null);

    await attachDocumentFile(sansTexte, new File(["%PDF"], "CV.pdf"), "Texte lu dans le PDF");
    await attachDocumentFile(avecTexte, new File(["docx"], "lettre.docx"), "Texte lu dans le Word");
    const docs = await rows<Document>("documents");
    expect(docs.map((d) => [d.label, d.content, d.fileName])).toEqual([
      ["CV importé", "Texte lu dans le PDF", "CV.pdf"],
      ["Lettre", "Mon texte", "lettre.docx"],
    ]);

    await attachDocumentFile(sansTexte, new File(["%PDF v2"], "CV-v2.pdf"), null);
    expect(stored.size).toBe(2);
    expect([...stored.keys()].some((p) => p.endsWith("CV.pdf"))).toBe(false);
  });
});
