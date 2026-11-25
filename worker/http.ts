/** Ce que Cloudflare fournit au serveur (voir wrangler.jsonc). */
export type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SUPABASE_URL: string;
  /** Clé publique (la même que dans le site) : les règles RLS de Supabase s'appliquent. */
  SUPABASE_PUBLISHABLE_KEY: string;
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
