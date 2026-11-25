import { downloadBlob } from "@/lib/download";
import { getDocument } from "@/services/documents";
import { getSettings } from "@/services/settings";

/** Télécharge une version de lettre en DOCX ou PDF (bibliothèques chargées seulement à ce moment-là). */
export async function downloadLetter(documentId: number, format: "docx" | "pdf"): Promise<void> {
  const [doc, { profile }, { letterToDocx, letterToPdf }] = await Promise.all([getDocument(documentId), getSettings(), import("@/lib/letter-export")]);
  if (!doc.content?.trim()) throw new Error("Ce document n'a pas de texte à exporter");
  const name = [doc.label, profile.fullName].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]+/g, " ").trim();
  const blob =
    format === "pdf" ? new Blob([new Uint8Array(await letterToPdf(doc.content, doc.label))], { type: "application/pdf" }) : await letterToDocx(doc.content);
  downloadBlob(`${name}.${format}`, blob);
}
