import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";

// Export d'une lettre telle qu'écrite (le texte contient déjà en-tête, objet, signature) :
// paragraphes séparés par une ligne vide, retours à la ligne simples conservés.

function paragraphs(content: string): string[][] {
  return content
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.split("\n"));
}

export async function letterToDocx(content: string): Promise<Blob> {
  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1300, bottom: 1300, left: 1300, right: 1300 } } },
        children: paragraphs(content).map(
          (lines) =>
            new Paragraph({
              spacing: { after: 200, line: 288 },
              children: lines.map((line, i) => new TextRun({ text: line, break: i > 0 ? 1 : 0 })),
            }),
        ),
      },
    ],
  });
  return Packer.toBlob(doc);
}

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 64;
const SIZE = 11;
const LEADING = 15.5;
const PARAGRAPH_GAP = 8;

/** Remplace les caractères absents de la police standard (WinAnsi) par un équivalent. */
function sanitizer(font: PDFFont) {
  const cache = new Map<string, string>();
  const fallbacks: Record<string, string> = { "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", " ": " ", " ": " ", "→": "->" };
  return (text: string) =>
    Array.from(text, (char) => {
      if (!cache.has(char)) {
        let out = char;
        try {
          font.encodeText(char);
        } catch {
          out = fallbacks[char] ?? "?";
        }
        cache.set(char, out);
      }
      return cache.get(char)!;
    }).join("");
}

export async function letterToPdf(content: string, title = "Lettre de motivation"): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const clean = sanitizer(font);
  const maxWidth = A4.width - 2 * MARGIN;
  let page = pdf.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN;

  const newLineSpace = () => {
    if (y - LEADING < MARGIN) {
      page = pdf.addPage([A4.width, A4.height]);
      y = A4.height - MARGIN;
    }
  };

  for (const lines of paragraphs(content)) {
    for (const rawLine of lines) {
      const words = clean(rawLine).split(/\s+/).filter(Boolean);
      let current = "";
      const flush = () => {
        newLineSpace();
        y -= LEADING;
        page.drawText(current, { x: MARGIN, y, size: SIZE, font });
        current = "";
      };
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, SIZE) > maxWidth && current) {
          flush();
          current = word;
        } else current = candidate;
      }
      if (current || words.length === 0) flush();
    }
    y -= PARAGRAPH_GAP;
  }
  return pdf.save();
}
