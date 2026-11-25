import { parse, type HTMLElement } from "node-html-parser";
import type { RemoteMode } from "./constants";

export type ImportedOffer = {
  title: string | null;
  company: string | null;
  location: string | null;
  remote: RemoteMode | null;
  offerText: string | null;
  /** `YYYY-MM-DD` (validThrough) */
  deadline: string | null;
  /** D'où viennent les infos : données structurées schema.org ou simple lecture de la page. */
  method: "json-ld" | "html";
};

const MAX_TEXT = 30_000;
const NOISE = "script, style, noscript, svg, nav, header, footer, form, button, iframe, [aria-hidden=true]";

function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT);
}

/** Texte lisible d'un fragment HTML (balises de bloc → retours à la ligne, entités décodées). */
export function htmlToText(html: string): string {
  // Certaines descriptions JSON-LD sont du HTML échappé (« &lt;p&gt; ») : on le décode d'abord.
  const source = !html.includes("<") && /&lt;\w/.test(html) ? parse(html).text : html;
  const root = parse(source, { blockTextElements: { script: false, style: false, noscript: false } });
  root.querySelectorAll(NOISE).forEach((el) => el.remove());
  return tidy(root.structuredText);
}

type Json = Record<string, unknown>;

function* walk(node: unknown): Generator<Json> {
  if (Array.isArray(node)) for (const item of node) yield* walk(item);
  else if (node && typeof node === "object") {
    yield node as Json;
    if ("@graph" in node) yield* walk((node as Json)["@graph"]);
  }
}

function isJobPosting(obj: Json): boolean {
  const type = obj["@type"];
  return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (value && typeof value === "object" && "name" in value) return text((value as Json).name);
  return null;
}

function locationOf(job: Json): string | null {
  const places = ([] as unknown[]).concat(job.jobLocation ?? []);
  const names = places.flatMap((p) => {
    const address = p && typeof p === "object" ? (p as Json).address : null;
    if (typeof address === "string") return [address];
    if (address && typeof address === "object") {
      const a = address as Json;
      return [text(a.addressLocality) ?? text(a.addressRegion) ?? text(a.addressCountry)].filter(Boolean) as string[];
    }
    return [];
  });
  return [...new Set(names)].join(", ") || null;
}

function fromJsonLd(root: HTMLElement): ImportedOffer | null {
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent);
    } catch {
      continue;
    }
    for (const obj of walk(data)) {
      if (!isJobPosting(obj)) continue;
      const deadline = typeof obj.validThrough === "string" && /^\d{4}-\d{2}-\d{2}/.test(obj.validThrough) ? obj.validThrough.slice(0, 10) : null;
      return {
        title: text(obj.title),
        company: text(obj.hiringOrganization),
        location: locationOf(obj),
        remote: obj.jobLocationType === "TELECOMMUTE" ? "full" : null,
        offerText: typeof obj.description === "string" ? htmlToText(obj.description) || null : null,
        deadline,
        method: "json-ld",
      };
    }
  }
  return null;
}

function meta(root: HTMLElement, property: string): string | null {
  return root.querySelector(`meta[property="${property}"], meta[name="${property}"]`)?.getAttribute("content")?.trim() || null;
}

/** Infos d'une offre à partir du HTML de sa page. */
export function parseOfferHtml(html: string): ImportedOffer {
  const root = parse(html, { blockTextElements: { script: true, style: false, noscript: false } });
  const structured = fromJsonLd(root);
  if (structured?.offerText && structured.title) return structured;

  const main = root.querySelector("main, article, [role=main]") ?? root.querySelector("body") ?? root;
  main.querySelectorAll(NOISE).forEach((el) => el.remove());
  const pageText = tidy(main.structuredText);
  return {
    title: structured?.title ?? meta(root, "og:title") ?? (root.querySelector("title")?.text.trim() || null),
    company: structured?.company ?? meta(root, "og:site_name"),
    location: structured?.location ?? null,
    remote: structured?.remote ?? null,
    offerText: structured?.offerText ?? (pageText || null),
    deadline: structured?.deadline ?? null,
    method: structured ? "json-ld" : "html",
  };
}

/**
 * robots.txt : le chemin est-il autorisé pour notre agent ? Règle la plus spécifique gagnante,
 * « Allow » prioritaire à égalité, jokers * et $ pris en charge.
 */
export function robotsAllows(robotsTxt: string, pathname: string, agent = "stagetracker"): boolean {
  type Group = { agents: string[]; rules: { allow: boolean; pattern: string }[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const match = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!match) continue;
    const [, field, value] = match;
    const key = field.toLowerCase();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      lastWasAgent = false;
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
    } else lastWasAgent = false;
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a)));
  const applicable = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of applicable.flatMap((g) => g.rules)) {
    const anchored = rule.pattern.endsWith("$");
    const body = (anchored ? rule.pattern.slice(0, -1) : rule.pattern)
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    const regex = new RegExp(`^${body}${anchored ? "$" : ""}`);
    if (!regex.test(pathname)) continue;
    const length = rule.pattern.length;
    if (!best || length > best.length || (length === best.length && rule.allow)) best = { allow: rule.allow, length };
  }
  return best?.allow ?? true;
}
