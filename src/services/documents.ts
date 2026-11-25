import { applyPlan, cmp, insert, ref, remove, row, rows, update, upsert } from "@/lib/db";
import type { DocumentKind } from "@/lib/domain/constants";
import { files } from "@/lib/storage";
import { checkFile, mimeFor } from "@/lib/text-extraction";
import type { Application, Document } from "@/lib/types";
import type { DocumentInput } from "@/lib/validation";
import { NotFoundError } from "./applications";

type DocumentLink = { applicationId: number; documentId: number; sentAt: string | null };

/** Crée une version de document (texte). */
export async function createDocument(input: DocumentInput & { isBase?: boolean }, now = new Date()): Promise<number> {
  return (await applyPlan([insert("documents", { ...input, createdAt: now.toISOString() })]))[0]!;
}

/**
 * Nouvelle version de document, avec son fichier éventuel (rangé d'abord dans le dossier de la personne)
 * et son lien à une candidature. Si l'enregistrement échoue, le fichier envoyé est retiré.
 */
export async function saveDocument(
  input: DocumentInput,
  file: File | null,
  link: { applicationId: number; sentAt: string | null } | null,
  now = new Date(),
): Promise<number> {
  if (file) checkFile(file);
  const filePath = file ? await files.upload(file, file.name, mimeFor(file.name)) : null;
  try {
    const ops = [insert("documents", { ...input, filePath, fileName: file?.name ?? null, mimeType: file ? mimeFor(file.name) : null, createdAt: now.toISOString() })];
    if (link) ops.push(insert("application_documents", { applicationId: link.applicationId, documentId: ref(0), sentAt: link.sentAt }));
    return (await applyPlan(ops))[0]!;
  } catch (error) {
    if (filePath) await files.remove([filePath]).catch(() => {});
    throw error;
  }
}

/**
 * Joint un fichier à une version existante (ou remplace le sien). `text` : texte lu dans le fichier, gardé
 * seulement si la version n'en avait pas. L'ancien fichier est retiré une fois la ligne mise à jour.
 */
export async function attachDocumentFile(id: number, file: File, text: string | null): Promise<void> {
  const doc = await row<Document>("documents", { id });
  if (!doc || doc.deletedAt) throw new NotFoundError("Document introuvable");
  checkFile(file);
  const filePath = await files.upload(file, file.name, mimeFor(file.name));
  try {
    await applyPlan([
      update("documents", { id }, { filePath, fileName: file.name, mimeType: mimeFor(file.name), ...(!doc.content?.trim() && text ? { content: text } : {}) }),
    ]);
  } catch (error) {
    await files.remove([filePath]).catch(() => {});
    throw error;
  }
  if (doc.filePath) await files.remove([doc.filePath]).catch(() => {});
}

/** Télécharge le fichier d'une version. */
export async function downloadDocumentFile(doc: Pick<Document, "filePath">): Promise<Blob> {
  if (!doc.filePath) throw new NotFoundError("Fichier introuvable");
  return files.download(doc.filePath);
}

export function linkDocument(applicationId: number, documentId: number, sentAt: string | null): Promise<void> {
  return upsert("application_documents", [{ applicationId, documentId, sentAt }], ["applicationId", "documentId"]);
}

/** Nouvelle version directement liée à une candidature, d'un bloc. */
export async function createAndLinkDocument(input: DocumentInput, applicationId: number, sentAt: string | null, now = new Date()): Promise<number> {
  const ids = await applyPlan([
    insert("documents", { ...input, createdAt: now.toISOString() }),
    insert("application_documents", { applicationId, documentId: ref(0), sentAt }),
  ]);
  return ids[0]!;
}

export async function unlinkDocument(applicationId: number, documentId: number): Promise<void> {
  await applyPlan([remove("application_documents", { applicationId, documentId })]);
}

/** Toutes les versions, avec les candidatures auxquelles chacune a été envoyée. */
export async function listDocuments() {
  const [documents, links, apps] = await Promise.all([
    rows<Document>("documents", { deletedAt: null }),
    rows<DocumentLink>("application_documents"),
    rows<Application>("applications", { deletedAt: null }),
  ]);
  const appById = new Map(apps.map((a) => [a.id, a]));
  const sentTo = new Map<number, { id: number; company: string; sentAt: string | null }[]>();
  for (const l of links.sort((a, b) => cmp(a.sentAt, b.sentAt))) {
    const app = appById.get(l.applicationId);
    if (app) sentTo.set(l.documentId, [...(sentTo.get(l.documentId) ?? []), { id: app.id, company: app.company, sentAt: l.sentAt }]);
  }
  return documents.sort((a, b) => cmp(b.createdAt, a.createdAt)).map((d) => ({ ...d, sentTo: sentTo.get(d.id) ?? [] }));
}

export type DocumentListItem = Awaited<ReturnType<typeof listDocuments>>[number];

/** Version « de base » (CV ou lettre) : référence pour les prompts et le diff des lettres. */
export async function getBaseDocument(kind: DocumentKind): Promise<Document | null> {
  return (await rows<Document>("documents", { kind, isBase: true, deletedAt: null })).sort((a, b) => cmp(b.createdAt, a.createdAt))[0] ?? null;
}

/** Une seule version de base par type. */
export async function setBaseDocument(id: number): Promise<void> {
  const doc = await row<Document>("documents", { id });
  if (!doc || doc.deletedAt) throw new NotFoundError("Document introuvable");
  await applyPlan([update("documents", { kind: doc.kind }, { isBase: false }), update("documents", { id }, { isBase: true })]);
}

/** Lettres liées à une candidature, la plus récente d'abord. */
export async function listApplicationLetters(applicationId: number) {
  const [links, documents] = await Promise.all([
    rows<DocumentLink>("application_documents", { applicationId }),
    rows<Document>("documents", { kind: "letter", deletedAt: null }),
  ]);
  return links
    .flatMap((l) => {
      const d = documents.find((doc) => doc.id === l.documentId);
      return d ? [{ ...d, sentAt: l.sentAt }] : [];
    })
    .sort((a, b) => cmp(b.createdAt, a.createdAt) || cmp(b.id, a.id));
}

/** Enregistre la lettre finale comme nouvelle version liée à la candidature (« v2 », « v3 »…). */
export async function saveLetterVersion(applicationId: number, content: string, now = new Date()): Promise<number> {
  const app = await row<Application>("applications", { id: applicationId });
  if (!app || app.deletedAt) throw new NotFoundError("Candidature introuvable");
  if (!content.trim()) throw new Error("La lettre est vide");
  const [links, letters] = await Promise.all([
    rows<DocumentLink>("application_documents", { applicationId }),
    rows<Document>("documents", { kind: "letter" }),
  ]);
  const letterIds = new Set(letters.map((d) => d.id));
  const n = links.filter((l) => letterIds.has(l.documentId)).length;
  return createAndLinkDocument({ kind: "letter", label: `Lettre — ${app.company} — v${n + 1}`, content: content.trim() }, applicationId, null, now);
}

export async function getDocument(id: number): Promise<Document> {
  const doc = await row<Document>("documents", { id });
  if (!doc) throw new NotFoundError("Document introuvable");
  return doc;
}
