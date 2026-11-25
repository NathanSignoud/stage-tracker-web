import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../worker/index";
import type { Env } from "../worker/http";
import { importOfferFromUrl } from "../worker/offer";

// Serveur du site (worker/) : import d'offre (tests repris de la version locale) et abonnement agenda.

const SUPABASE = "https://projet.supabase.co";
const env: Env = { SUPABASE_URL: SUPABASE, SUPABASE_PUBLISHABLE_KEY: "cle-publique", ASSETS: { fetch: async () => new Response("site statique") } };

const html = `<html><head><title>Stage ML</title><script type="application/ld+json">
{"@type":"JobPosting","title":"Stage ML Engineer","hiringOrganization":{"name":"Acme"},"description":"Python, PyTorch"}
</script></head><body></body></html>`;

function stubFetch(routes: Record<string, (init?: RequestInit) => Response>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const route = routes[url];
    return route ? route(init) : new Response("", { status: 404 });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("import d'offre par lien", () => {
  it("lit une page d'offre et suit une redirection publique", async () => {
    stubFetch({
      "https://jobs.example.com/o/1": () => new Response(null, { status: 302, headers: { location: "/offres/stage-ml" } }),
      "https://jobs.example.com/offres/stage-ml": () => new Response(html, { headers: { "content-type": "text/html" } }),
    });
    const offer = await importOfferFromUrl("https://jobs.example.com/o/1");
    expect(offer.title).toBe("Stage ML Engineer");
    expect(offer.url).toBe("https://jobs.example.com/offres/stage-ml");
  });

  it("refuse une redirection vers une adresse interne sans la contacter", async () => {
    const calls = stubFetch({
      "https://jobs.example.com/o/2": () => new Response(null, { status: 301, headers: { location: "http://169.254.169.254/latest/meta-data" } }),
    });
    await expect(importOfferFromUrl("https://jobs.example.com/o/2")).rejects.toThrow("Adresse locale refusée");
    expect(calls.some((u) => u.includes("169.254"))).toBe(false);
  });

  it("refuse LinkedIn sans aucune requête", async () => {
    const calls = stubFetch({});
    await expect(importOfferFromUrl("https://www.linkedin.com/jobs/view/1")).rejects.toThrow(/LinkedIn/);
    expect(calls).toEqual([]);
  });

  it("respecte robots.txt", async () => {
    const calls = stubFetch({ "https://jobs.example.com/robots.txt": () => new Response("User-agent: *\nDisallow: /offres/") });
    await expect(importOfferFromUrl("https://jobs.example.com/offres/1")).rejects.toThrow(/interdit la lecture automatique/);
    expect(calls).toEqual(["https://jobs.example.com/robots.txt"]);
  });

  it("refuse une page trop volumineuse", async () => {
    stubFetch({
      "https://jobs.example.com/gros": () => new Response("x".repeat(3_100_000), { headers: { "content-type": "text/html" } }),
    });
    await expect(importOfferFromUrl("https://jobs.example.com/gros")).rejects.toThrow(/volumineuse/);
  });
});

describe("serveur : /api/offer", () => {
  const post = (headers: Record<string, string> = {}) =>
    worker.fetch(new Request("https://site.test/api/offer", { method: "POST", headers, body: JSON.stringify({ url: "https://jobs.example.com/o/3" }) }), env);

  it("réservé aux personnes connectées (sinon : relais ouvert à tous)", async () => {
    const calls = stubFetch({ [`${SUPABASE}/auth/v1/user`]: () => new Response("{}", { status: 401 }) });
    expect((await post({ Authorization: "Bearer faux" })).status).toBe(401);
    expect((await post()).status).toBe(401);
    expect(calls.some((u) => u.includes("jobs.example.com"))).toBe(false);
  });

  it("renvoie l'offre lue à une personne connectée", async () => {
    stubFetch({
      [`${SUPABASE}/auth/v1/user`]: () => Response.json({ id: "u1" }),
      "https://jobs.example.com/o/3": () => new Response(html, { headers: { "content-type": "text/html" } }),
    });
    const res = await post({ Authorization: "Bearer vrai" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ title: "Stage ML Engineer", company: "Acme" });
  });

  it("les autres adresses servent le site statique", async () => {
    expect(await (await worker.fetch(new Request("https://site.test/candidatures"), env)).text()).toBe("site statique");
    expect((await worker.fetch(new Request("https://site.test/api/inconnu"), env)).status).toBe(404);
  });
});

describe("serveur : abonnement agenda", () => {
  const TOKEN = "abcdefghijklmnopqrstuvwx";
  const inAMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const feed = () => worker.fetch(new Request(`https://site.test/api/calendar/${TOKEN}.ics`), env);

  it("renvoie les entretiens et dates limites de la personne, à l'heure de son fuseau", async () => {
    let sent: unknown;
    stubFetch({
      [`${SUPABASE}/rest/v1/rpc/calendar_feed`]: (init) => {
        sent = JSON.parse(String(init?.body));
        return Response.json({
          timeZone: "Europe/Paris",
          applications: [
            { id: 1, company: "Mistral AI", title: "Stage LLM", status: "hr_interview", deadline: null, deleted_at: null },
            { id: 2, company: "Owkin", title: "", status: "to_apply", deadline: inAMonth, deleted_at: null },
          ],
          interactions: [
            { id: 7, application_id: 1, contact_id: 3, date: "2099-01-10T14:30", type: "interview", interview_kind: "hr", summary: "Entretien RH", content: null, location: "Teams", duration_minutes: 45, updated_at: "2099-01-01T00:00:00.000Z" },
          ],
          contacts: [{ id: 3, name: "Camille" }],
        });
      },
    });
    const res = await feed();
    const ics = await res.text();
    expect(sent).toEqual({ feed_token: TOKEN });
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(ics).toContain("SUMMARY:Entretien RH · Mistral AI");
    expect(ics).toContain("DTSTART:20990110T133000Z"); // 14 h 30 à Paris en hiver = 13 h 30 UTC
    expect(ics).toContain("Contact : Camille");
    expect(ics).toContain("URL:https://site.test/candidatures/1");
    expect(ics).toContain("SUMMARY:Date limite · Owkin");
  });

  it("jeton inconnu → 404", async () => {
    stubFetch({ [`${SUPABASE}/rest/v1/rpc/calendar_feed`]: () => Response.json(null) });
    expect((await feed()).status).toBe(404);
  });

  it("jeton mal formé : la base n'est même pas interrogée", async () => {
    const calls = stubFetch({});
    expect((await worker.fetch(new Request("https://site.test/api/calendar/court.ics"), env)).status).toBe(404);
    expect(calls).toEqual([]);
  });
});
