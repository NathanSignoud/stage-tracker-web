// Texte d'un CV / d'une lettre envoyé en fichier (repris de la version locale, côté navigateur) : il sert au
// diff des lettres et aux prompts. Bibliothèques chargées seulement quand un fichier est lu.

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".doc", ".odt", ".md", ".txt"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // même limite que l'espace de stockage

const extension = (fileName: string) => fileName.slice(fileName.lastIndexOf(".")).toLowerCase();

export function mimeFor(fileName: string): string {
  return (
    {
      ".pdf": "application/pdf",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc": "application/msword",
      ".odt": "application/vnd.oasis.opendocument.text",
      ".md": "text/markdown",
      ".txt": "text/plain",
    }[extension(fileName)] ?? "application/octet-stream"
  );
}

/** Refuse avant l'envoi ce que l'espace de stockage refuserait (message clair plutôt qu'une erreur technique). */
export function checkFile(file: { name: string; size: number }): void {
  if (!ACCEPTED_EXTENSIONS.includes(extension(file.name))) {
    throw new Error(`Format non accepté : ${ACCEPTED_EXTENSIONS.join(", ")}`);
  }
  if (file.size > MAX_FILE_BYTES) throw new Error("Fichier trop lourd (10 Mo maximum)");
}

/** Texte brut (DOCX, PDF, Markdown, texte) ; null si illisible : il pourra être collé à la main. */
export async function extractDocumentText(fileName: string, bytes: Uint8Array): Promise<string | null> {
  const ext = extension(fileName);
  try {
    let text = "";
    if (ext === ".docx") {
      const mammoth = (await import("mammoth")).default;
      const data = bytes.slice().buffer;
      // La version navigateur de mammoth lit `arrayBuffer`, la version Node (tests) lit `buffer`.
      text = (await mammoth.extractRawText({ arrayBuffer: data, buffer: data } as { arrayBuffer: ArrayBuffer })).value;
    } else if (ext === ".pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      text = (await extractText(await getDocumentProxy(bytes.slice()), { mergePages: true })).text;
    } else if (ext === ".md" || ext === ".txt") {
      text = new TextDecoder("utf-8").decode(bytes);
    }
    text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return text || null;
  } catch {
    return null; // PDF scanné, fichier corrompu… : le texte pourra être collé à la main.
  }
}
