// Analyse d'une offre par mots-clés : détection (insensible à la casse et aux accents, alias
// inclus), surlignage et score = compétences détectées que je maîtrise / compétences détectées.

export type MatchKeyword = { id: number; label: string; aliases: string[]; mine: boolean };
export type KeywordHit = { keyword: MatchKeyword; ranges: [number, number][] };
export type MatchResult = {
  hits: KeywordHit[];
  /** Détectées et maîtrisées. */
  mine: KeywordHit[];
  /** Détectées mais pas (encore) maîtrisées : à travailler ou à ne pas revendiquer. */
  missing: KeywordHit[];
  /** 0–1, null si aucune compétence de la liste n'apparaît dans l'offre. */
  score: number | null;
};

const WORD_CHAR = /[\p{L}\p{N}]/u;
// Langages à une lettre (R, C) : délimiteurs stricts, sinon « R&D » ou « C'est » matchent.
const SINGLE_BEFORE = /[\s,;/(]/;
const SINGLE_AFTER = /[\s,;/).]/;

/**
 * Minuscules, sans accents, tirets → espaces — en conservant EXACTEMENT la longueur du texte,
 * pour que les positions trouvées s'appliquent au texte d'origine (surlignage).
 */
export function foldForMatch(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    if (code >= 0xd800 && code <= 0xdfff) {
      out += char; // moitié d'un emoji : inchangée
      continue;
    }
    if (char === "-" || char === "‑" || char === " ") {
      out += " ";
      continue;
    }
    const folded = char.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    out += folded.length === 1 ? folded : (folded[0] ?? " ");
  }
  return out;
}

function boundaryOk(text: string, start: number, end: number, term: string): boolean {
  const before = start > 0 ? text[start - 1] : "";
  const after = end < text.length ? text[end] : "";
  if (term.length === 1 && WORD_CHAR.test(term)) {
    return (!before || SINGLE_BEFORE.test(before)) && (!after || SINGLE_AFTER.test(after));
  }
  const startsWithWord = WORD_CHAR.test(term[0]);
  const endsWithWord = WORD_CHAR.test(term[term.length - 1]);
  if (startsWithWord && before && WORD_CHAR.test(before)) return false;
  if (after && WORD_CHAR.test(after)) return false;
  // « C++ » ne doit pas matcher « C+++ » ; « C# » pas « C## ».
  if (!endsWithWord && after && after === term[term.length - 1]) return false;
  return true;
}

function findTerm(folded: string, term: string): [number, number][] {
  const ranges: [number, number][] = [];
  if (!term) return ranges;
  let from = 0;
  for (;;) {
    const start = folded.indexOf(term, from);
    if (start === -1) break;
    const end = start + term.length;
    if (boundaryOk(folded, start, end, term)) ranges.push([start, end]);
    from = start + 1;
  }
  return ranges;
}

export function matchKeywords(text: string, keywords: MatchKeyword[]): MatchResult {
  const folded = foldForMatch(text);
  const hits: KeywordHit[] = [];
  for (const keyword of keywords) {
    const terms = [keyword.label, ...keyword.aliases].map((t) => foldForMatch(t.trim())).filter(Boolean);
    const ranges = [...new Set(terms)].flatMap((t) => findTerm(folded, t)).sort((a, b) => a[0] - b[0]);
    if (ranges.length) hits.push({ keyword, ranges });
  }
  const mine = hits.filter((h) => h.keyword.mine);
  const missing = hits.filter((h) => !h.keyword.mine);
  return {
    hits,
    mine,
    missing,
    score: hits.length ? Math.round((mine.length / hits.length) * 100) / 100 : null,
  };
}

export type Segment = { text: string; hit?: { keywordId: number; mine: boolean; label: string } };

/** Découpe le texte en segments surlignables (les chevauchements gardent la 1re détection). */
export function highlightSegments(text: string, hits: KeywordHit[]): Segment[] {
  const marks = hits
    .flatMap((h) => h.ranges.map(([start, end]) => ({ start, end, hit: { keywordId: h.keyword.id, mine: h.keyword.mine, label: h.keyword.label } })))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of marks) {
    if (m.start < cursor) continue;
    if (m.start > cursor) segments.push({ text: text.slice(cursor, m.start) });
    segments.push({ text: text.slice(m.start, m.end), hit: m.hit });
    cursor = m.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
