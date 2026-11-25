import { describe, expect, it } from "vitest";
import { htmlToText, parseOfferHtml, robotsAllows } from "@/lib/domain/offer-parsing";

describe("import d'offre", () => {
  it("lit les données structurées JobPosting", () => {
    const html = `<html><head><title>Offre</title>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Organization", name: "Ignoré" },
          {
            "@type": "JobPosting",
            title: "Stage — Machine Learning Engineer",
            hiringOrganization: { "@type": "Organization", name: "Photoroom" },
            jobLocation: [{ address: { addressLocality: "Paris" } }, { address: { addressLocality: "Paris" } }],
            validThrough: "2026-11-30T23:59:00+01:00",
            description: "&lt;p&gt;Tu rejoindras l&amp;#39;équipe ML.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;PyTorch&lt;/li&gt;&lt;/ul&gt;",
          },
        ],
      })}</script></head><body>…</body></html>`;
    expect(parseOfferHtml(html)).toEqual({
      title: "Stage — Machine Learning Engineer",
      company: "Photoroom",
      location: "Paris",
      remote: null,
      offerText: "Tu rejoindras l'équipe ML.\nPyTorch",
      deadline: "2026-11-30",
      method: "json-ld",
    });
  });

  it("à défaut, lit le contenu principal de la page", () => {
    const html = `<html><head><title>Data Scientist – Stage</title><meta property="og:site_name" content="Doctolib"></head>
      <body><nav>Menu</nav><main><h1>Data Scientist – Stage</h1><p>Missions :</p><ul><li>Modèles NLP</li></ul></main><footer>©</footer></body></html>`;
    const offer = parseOfferHtml(html);
    expect(offer).toMatchObject({ title: "Data Scientist – Stage", company: "Doctolib", method: "html" });
    expect(offer.offerText).toBe("Data Scientist – Stage\nMissions :\nModèles NLP");
    expect(htmlToText("<p>a<br>b</p><script>x()</script>")).toBe("a\nb");
  });

  it("respecte robots.txt", () => {
    const robots = `User-agent: *\nDisallow: /jobs/\nAllow: /jobs/public/\n\nUser-agent: GPTBot\nDisallow: /`;
    expect(robotsAllows(robots, "/careers/123")).toBe(true);
    expect(robotsAllows(robots, "/jobs/123")).toBe(false);
    expect(robotsAllows(robots, "/jobs/public/123")).toBe(true);
    expect(robotsAllows("User-agent: *\nDisallow: /*.pdf$", "/offre.pdf")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /*.pdf$", "/offre.pdf?x")).toBe(true);
    expect(robotsAllows("User-agent: StageTracker\nDisallow: /\n\nUser-agent: *\nAllow: /", "/x")).toBe(false);
    expect(robotsAllows("", "/x")).toBe(true);
  });
});
