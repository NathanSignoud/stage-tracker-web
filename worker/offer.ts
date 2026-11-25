import { parseOfferHtml, robotsAllows, type ImportedOffer } from "../src/lib/domain/offer-parsing";
import { json, type Env } from "./http";

// Lecture ponctuelle d'UNE page d'offre dont l'utilisateur colle le lien (repris de la version locale,
// src/server/services/offer-import.ts). Pas de scraping : robots.txt est respecté, LinkedIn (qui interdit
// la lecture automatique) est refusé d'office, chaque redirection est vérifiée AVANT d'être suivie.

const USER_AGENT = "StageTracker/1.0 (outil personnel de suivi de candidatures)";
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 5;
const REFUSED_HOSTS = [/(^|\.)linkedin\.com$/i];
// Adresses internes : réseau local, boucle locale, lien local (dont 169.254.169.254 des clouds), IPv6 privées.
const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|0\.|\[?::1?\]?$|\[?f[cd][0-9a-f]{2}:|\[?fe80:|.*\.local$|.*\.internal$)/i;

export class OfferImportError extends Error {}

function checkHost(url: URL): void {
  if (REFUSED_HOSTS.some((r) => r.test(url.hostname))) {
    throw new OfferImportError("LinkedIn interdit la lecture automatique de ses pages : copie-colle le texte de l'offre.");
  }
  if (PRIVATE_HOST.test(url.hostname)) throw new OfferImportError("Adresse locale refusée.");
}

/** Suit les redirections une à une pour vérifier chaque adresse AVANT de la contacter. */
async function get(url: string, timeoutMs: number): Promise<{ res: Response; finalUrl: string }> {
  const signal = AbortSignal.timeout(timeoutMs);
  let current = new URL(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    checkHost(current);
    const res = await fetch(current, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      signal,
    });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) return { res, finalUrl: current.href };
    current = new URL(location, current);
    if (current.protocol !== "http:" && current.protocol !== "https:") throw new OfferImportError("Redirection refusée.");
  }
  throw new OfferImportError("Trop de redirections : copie-colle le texte de l'offre.");
}

/** Lit le corps sans dépasser `max` octets (une page énorme ne doit pas saturer la mémoire du serveur). */
async function readCapped(res: Response, max: number): Promise<string> {
  if (Number(res.headers.get("content-length") ?? 0) > max) throw new OfferImportError("Page trop volumineuse.");
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new OfferImportError("Page trop volumineuse.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function importOfferFromUrl(raw: string): Promise<ImportedOffer & { url: string }> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new OfferImportError("Lien invalide.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new OfferImportError("Lien invalide (http ou https).");
  checkHost(url);

  try {
    const { res: robots } = await get(`${url.origin}/robots.txt`, 5_000);
    if (robots.ok && !robotsAllows(await readCapped(robots, 500_000), url.pathname + url.search)) {
      throw new OfferImportError("Ce site interdit la lecture automatique de cette page : copie-colle le texte de l'offre.");
    }
  } catch (error) {
    if (error instanceof OfferImportError) throw error;
    // robots.txt injoignable : traité comme absent.
  }

  let res: Response;
  let finalUrl: string;
  try {
    ({ res, finalUrl } = await get(url.href, 12_000));
  } catch (error) {
    if (error instanceof OfferImportError) throw error;
    throw new OfferImportError("Page injoignable (délai dépassé ou site hors ligne).");
  }
  if (!res.ok) throw new OfferImportError(`La page a répondu ${res.status} : copie-colle le texte de l'offre.`);
  if (!(res.headers.get("content-type") ?? "").includes("html")) throw new OfferImportError("Ce lien n'est pas une page web.");
  const offer = parseOfferHtml(await readCapped(res, MAX_BYTES));
  if (!offer.title && !offer.offerText) {
    throw new OfferImportError("Impossible de lire cette page (contenu chargé dynamiquement ?) : copie-colle le texte de l'offre.");
  }
  return { ...offer, url: finalUrl };
}

/** Personne connectée au site (jeton Supabase envoyé par le navigateur), sinon null. */
async function authenticatedUser(request: Request, env: Env): Promise<{ id: string } | null> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: auth } });
  return res.ok ? ((await res.json()) as { id: string }) : null;
}

/** POST /api/offer { url } : réservé aux personnes connectées (sinon, le site servirait de relais à n'importe qui). */
export async function handleOfferImport(request: Request, env: Env): Promise<Response> {
  if (!(await authenticatedUser(request, env))) return json({ error: "Connecte-toi pour importer une offre." }, 401);
  let url: unknown;
  try {
    ({ url } = (await request.json()) as { url?: unknown });
  } catch {
    return json({ error: "Lien invalide." }, 400);
  }
  if (typeof url !== "string" || url.length > 2000) return json({ error: "Lien invalide." }, 400);
  try {
    return json(await importOfferFromUrl(url));
  } catch (error) {
    return json({ error: error instanceof OfferImportError ? error.message : "Lecture impossible : copie-colle le texte de l'offre." }, 422);
  }
}
