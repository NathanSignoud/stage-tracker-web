import { normalizeText } from "@/lib/text";

// Import d'une liste d'entreprises collée depuis Claude (ou un tableur) : tableau Markdown, CSV
// (« ; » ou « , »), TSV (copie Excel / Sheets), JSON, ou simple liste à puces.

export type CompanyRow = {
  name: string;
  careersUrl: string | null;
  location: string | null;
  sector: string | null;
  notes: string | null;
};
export type CompanyField = keyof CompanyRow;
export type ListFormat = "markdown" | "csv" | "tsv" | "json" | "lines";

export type ParsedCompanyList = {
  format: ListFormat | null;
  rows: CompanyRow[];
  /** Colonne d'origine utilisée pour chaque champ (affichée dans l'aperçu). */
  columns: Partial<Record<CompanyField, string>>;
  skipped: { line: number; reason: string }[];
};

/** Clé de rapprochement d'un nom d'entreprise : « Hugging Face » = « hugging-face » = « HuggingFace ». */
export function companyKey(name: string): string {
  return normalizeText(name).replace(/[^a-z0-9]/g, "");
}

// Alias d'en-têtes, du plus spécifique au plus générique (l'ordre départage « site carrière » / « site web »).
const ALIASES: Record<CompanyField, string[]> = {
  name: ["entreprise", "societe", "company", "nom", "name", "organisation", "organization", "startup", "boite", "employeur", "nom de l entreprise"],
  careersUrl: [
    "site carriere", "page carriere", "site carrieres", "page carrieres", "lien carriere", "url carriere", "careers url",
    "careers page", "careers", "career", "carriere", "carrieres", "jobs", "offres", "recrutement",
    "lien", "url", "site", "site web", "website", "web",
  ],
  location: ["localisation", "lieu", "ville", "villes", "location", "city", "siege", "bureaux", "adresse", "region"],
  sector: ["secteur", "domaine", "industrie", "industry", "sector", "activite", "type"],
  notes: ["notes", "note", "pourquoi", "commentaire", "commentaires", "remarque", "description", "why", "pertinence", "raison", "interet"],
};

const EMPTY = new Set(["", "-", "—", "–", "n/a", "na", "?", "aucun", "aucune", "none", "null"]);
const URL_RE = /https?:\/\/[^\s<>()"'|]+/i;
const DOMAIN_TOKEN = /(?:^|\s)((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?)/i;
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

function headerKey(header: string): string {
  return normalizeText(header).replace(/[^a-z0-9]+/g, " ").trim();
}

/** Associe chaque champ à la colonne la plus probable (alias exact > alias contenu). */
function mapColumns(headers: string[]): Map<number, CompanyField> {
  const candidates: { col: number; field: CompanyField; score: number }[] = [];
  headers.forEach((h, col) => {
    const key = headerKey(h);
    if (!key) return;
    for (const field of Object.keys(ALIASES) as CompanyField[]) {
      ALIASES[field].forEach((alias, i) => {
        if (key === alias) candidates.push({ col, field, score: i });
        else if (` ${key} `.includes(` ${alias} `)) candidates.push({ col, field, score: 100 + i });
      });
    }
  });
  candidates.sort((a, b) => a.score - b.score);
  const byCol = new Map<number, CompanyField>();
  const used = new Set<CompanyField>();
  for (const c of candidates) {
    if (byCol.has(c.col) || used.has(c.field)) continue;
    byCol.set(c.col, c.field);
    used.add(c.field);
  }
  return byCol;
}

/** Retire la mise en forme Markdown ; un lien [texte](url) donne son texte. */
function cleanText(cell: string): string | null {
  const text = cell
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(/<(https?:\/\/[^>]+)>/g, "$1")
    .replace(/(\*\*|__|`)/g, "")
    .replace(/^\*(.+)\*$/, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return EMPTY.has(text.toLowerCase()) ? null : text;
}

/** URL d'une cellule : lien Markdown, URL nue, ou domaine sans « https:// ». */
export function cleanUrl(cell: string | null | undefined): string | null {
  if (!cell) return null;
  const linked = cell.match(/\]\((https?:\/\/[^)\s]+)\)/i)?.[1] ?? cell.match(URL_RE)?.[0];
  if (linked) return linked.replace(/[.,;:)]+$/, "");
  const bare = cell.replace(/[*_`<>]/g, "").trim();
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(bare)) return `https://${bare.replace(/[.,;:]+$/, "")}`;
  return null;
}

function stripFences(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((l) => !/^\s*```/.test(l))
    .join("\n");
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

function parseMarkdownTable(lines: string[]): string[][] {
  return lines
    .filter((l) => l.trim().startsWith("|"))
    .filter((l) => !/^[\s|:-]+$/.test(l)) // ligne de séparation |---|:--:|
    .map((l) =>
      l
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split(/(?<!\\)\|/)
        .map((c) => c.replace(/\\\|/g, "|")),
    );
}

function delimiterOf(line: string): string | null {
  const counts = { ";": 0, ",": 0 } as Record<string, number>;
  let quoted = false;
  for (const c of line) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && c in counts) counts[c]++;
  }
  if (!counts[";"] && !counts[","]) return null;
  return counts[";"] >= counts[","] ? ";" : ",";
}

/** Une ligne de tableau → entreprise, à partir de l'association colonnes → champs. */
function toRow(cells: string[], mapping: Map<number, CompanyField>): CompanyRow {
  const row: CompanyRow = { name: "", careersUrl: null, location: null, sector: null, notes: null };
  cells.forEach((raw, col) => {
    const field = mapping.get(col);
    if (!field) return;
    if (field === "careersUrl") row.careersUrl = cleanUrl(raw);
    else if (field === "name") row.name = cleanText(raw) ?? "";
    else row[field] = cleanText(raw);
  });
  return row;
}

/** Sans ligne d'en-tête reconnue : la colonne d'URL = site carrière, puis nom, lieu, et le reste en notes. */
function inferMapping(table: string[][]): Map<number, CompanyField> {
  const width = Math.max(...table.map((r) => r.length));
  const urlCol = [...Array(width).keys()].find((c) => table.filter((r) => cleanUrl(r[c])).length >= table.length / 2);
  const others = [...Array(width).keys()].filter((c) => c !== urlCol);
  const mapping = new Map<number, CompanyField>();
  if (urlCol !== undefined) mapping.set(urlCol, "careersUrl");
  (["name", "location", "sector", "notes"] as CompanyField[]).forEach((field, i) => {
    if (others[i] !== undefined) mapping.set(others[i], field);
  });
  return mapping;
}

function fromTable(table: string[][], format: ListFormat, firstLine = 1): ParsedCompanyList {
  if (!table.length) return { format, rows: [], columns: {}, skipped: [] };
  const headerMapping = mapColumns(table[0]);
  // Une ligne qui contient une adresse est une donnée, pas un en-tête (« …/careers » ressemble à un alias).
  const hasHeader =
    !table[0].some((cell) => cleanUrl(cell)) && [...headerMapping.values()].some((f) => f === "name" || f === "careersUrl");
  const mapping = hasHeader ? headerMapping : inferMapping(table);
  const columns: Partial<Record<CompanyField, string>> = {};
  for (const [col, field] of mapping) columns[field] = hasHeader ? table[0][col]?.trim() : `colonne ${col + 1}`;
  const body = hasHeader ? table.slice(1) : table;
  const offset = hasHeader ? firstLine + 1 : firstLine;
  return finalize(format, body.map((cells, i) => ({ line: offset + i, row: toRow(cells, mapping) })), columns);
}

function fromJson(data: unknown): ParsedCompanyList | null {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? Object.values(data as Record<string, unknown>).find(Array.isArray)
      : null;
  if (!list?.length || typeof list[0] !== "object") return null;
  const headers = [...new Set(list.flatMap((o) => Object.keys(o as object)))];
  const table = [headers, ...list.map((o) => headers.map((h) => String((o as Record<string, unknown>)[h] ?? "")))];
  return fromTable(table, "json");
}

/** « Paris », « Paris / Lyon », « Île-de-France », « Remote » ; pas « LLM open source ». */
function looksLikePlace(part: string): boolean {
  if (/^(full )?remote$|^t[ée]l[ée]travail$|^hybride$/i.test(part)) return true;
  const words = part.split(/[\s/,]+/).filter(Boolean);
  return words.length <= 4 && words.every((w) => /^\p{Lu}/u.test(w) || /^(et|sur|en|de|du|la|le|&)$/i.test(w));
}

/** Liste à puces : « - **Mistral AI** (Paris) — https://mistral.ai/careers — LLM open source ». */
function fromLines(lines: string[]): ParsedCompanyList {
  const items = lines.map((raw, i) => {
    const line = raw.replace(BULLET, "").trim();
    // URL complète, sinon domaine nu (« criteo.com/careers ») au milieu de la ligne.
    const careersUrl = cleanUrl(line.match(/\]\([^)]+\)/)?.[0] ?? line.match(URL_RE)?.[0] ?? line.match(DOMAIN_TOKEN)?.[1]);
    const rest = line
      .replace(/\[([^\]]*)\]\([^)]*\)/g, " ")
      .replace(URL_RE, " ")
      .replace(new RegExp(DOMAIN_TOKEN, "gi"), " ");
    const parts = rest
      .replace(/\s+/g, " ")
      .split(/\s*[—–|]\s*|\s+-\s+|\s*:\s+/)
      .map((p) => cleanText(p.replace(/^[,;:\s]+|[,;:\s]+$/g, "")))
      .filter((p): p is string => Boolean(p));
    let name = parts.shift() ?? "";
    let location: string | null = null;
    const paren = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (paren) [, name, location] = paren;
    if (!location && parts.length && (parts.length > 1 || looksLikePlace(parts[0]))) location = parts.shift() ?? null;
    return { line: i + 1, row: { name: name.trim(), careersUrl, location, sector: null, notes: parts.join(" — ") || null } };
  });
  return finalize("lines", items, {});
}

/** Lignes sans nom écartées ; doublons (même entreprise) fusionnés dans la première occurrence. */
function finalize(
  format: ListFormat,
  items: { line: number; row: CompanyRow }[],
  columns: Partial<Record<CompanyField, string>>,
): ParsedCompanyList {
  const rows: CompanyRow[] = [];
  const byKey = new Map<string, CompanyRow>();
  const skipped: ParsedCompanyList["skipped"] = [];
  for (const { line, row } of items) {
    const key = companyKey(row.name);
    if (!key) {
      if (Object.values(row).some(Boolean)) skipped.push({ line, reason: "nom d'entreprise manquant" });
      continue;
    }
    const first = byKey.get(key);
    if (first) {
      for (const f of ["careersUrl", "location", "sector", "notes"] as const) first[f] ??= row[f];
      skipped.push({ line, reason: `doublon de « ${first.name} » (fusionné)` });
      continue;
    }
    byKey.set(key, row);
    rows.push(row);
  }
  return { format, rows, columns, skipped };
}

export function parseCompanyList(input: string): ParsedCompanyList {
  const text = stripFences(input).trim();
  if (!text) return { format: null, rows: [], columns: {}, skipped: [] };

  if (/^[[{]/.test(text)) {
    try {
      const parsed = fromJson(JSON.parse(text));
      if (parsed) return parsed;
    } catch {
      // Pas du JSON : on essaie les autres formats.
    }
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.filter((l) => l.trim().startsWith("|")).length >= 2) return fromTable(parseMarkdownTable(lines), "markdown");
  if (lines.filter((l) => l.includes("\t")).length >= Math.max(1, lines.length / 2)) {
    return fromTable(parseDelimited(text, "\t"), "tsv");
  }
  // CSV : jugé sur le résultat de la lecture (une cellule entre guillemets peut contenir des retours à la
  // ligne) ; une liste à puces contenant des virgules n'en est pas un.
  const delimiter = BULLET.test(lines[0]) ? null : delimiterOf(lines[0]);
  if (delimiter) {
    const table = parseDelimited(text, delimiter);
    const wide = table.filter((r) => r.length >= 2).length;
    if (table.length > 1 && table[0].length >= 2 && wide >= table.length * 0.8) return fromTable(table, "csv");
  }
  return fromLines(lines);
}
