import { Link } from "react-router";
import { Tile } from "@/components/dashboard/tile";
import type { Dashboard } from "@/services/dashboard";

/** Taux de réponse (anneau) + les trois chiffres clés du pipeline. */
export function ResponseTile({
  responses,
  totals,
  className,
}: {
  responses: Dashboard["responses"];
  totals: Dashboard["totals"];
  className?: string;
}) {
  const rate = responses.sent ? Math.round((responses.responded / responses.sent) * 100) : null;
  const figures = [
    { label: "En cours", value: totals.active },
    { label: "En entretien", value: totals.inInterview },
    { label: totals.offers > 1 ? "Offres" : "Offre", value: totals.offers },
  ];

  return (
    <Tile tone="stat" title="Taux de réponse" className={className}>
      <div className="flex items-center gap-5">
        <div
          role="img"
          aria-label={rate === null ? "Pas encore de candidature envoyée" : `Taux de réponse : ${rate} %`}
          className="grid size-24 shrink-0 place-items-center rounded-full"
          style={{
            background:
              rate === null
                ? "color-mix(in srgb, var(--tile-stat-ink) 15%, transparent)"
                : `conic-gradient(var(--tile-stat-ink) 0 ${rate}%, color-mix(in srgb, var(--tile-stat-ink) 15%, transparent) ${rate}% 100%)`,
          }}
        >
          <span className="grid size-[4.5rem] place-items-center rounded-full bg-tile-stat font-heading text-lg font-bold">
            {rate === null ? "—" : `${rate} %`}
          </span>
        </div>
        <p className="text-sm text-tile-stat-ink">
          {responses.sent
            ? `${responses.responded} entreprise${responses.responded > 1 ? "s" : ""} sur ${responses.sent} t'${responses.responded > 1 ? "ont" : "a"} répondu.`
            : "Le taux s'affichera dès ta première candidature envoyée."}
        </p>
      </div>
      <Link to="/candidatures" className="mt-auto grid grid-cols-3 gap-2 rounded-2xl bg-background/60 p-3 hover:bg-background/80">
        {figures.map((f) => (
          <span key={f.label} className="min-w-0">
            <span className="block font-heading text-xl font-bold">{f.value}</span>
            <span className="block truncate text-xs text-tile-stat-ink">{f.label}</span>
          </span>
        ))}
      </Link>
    </Tile>
  );
}
