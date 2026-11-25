import { handleCalendarFeed, keepSupabaseAwake } from "./calendar";
import { json, type Env } from "./http";
import { handleOfferImport } from "./offer";

// Serveur du site (Cloudflare Worker) : seules les adresses /api/* passent ici (wrangler.jsonc,
// assets.run_worker_first) ; tout le reste est servi tel quel depuis dist/ (le site statique).

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/offer") {
      return request.method === "POST" ? handleOfferImport(request, env) : json({ error: "Méthode non autorisée" }, 405);
    }
    const feed = pathname.match(/^\/api\/calendar\/([A-Za-z0-9_-]{20,64})\.ics$/);
    if (feed && request.method === "GET") return handleCalendarFeed(feed[1], request, env);
    if (pathname.startsWith("/api/")) return json({ error: "Introuvable" }, 404);
    return env.ASSETS.fetch(request);
  },

  /** Tâche planifiée (wrangler.jsonc, triggers.crons) : une fois par jour. */
  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(keepSupabaseAwake(env));
  },
};
