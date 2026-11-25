import { Check, CircleDashed, Download, Pencil, Settings2 } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { Panel } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import type { Segment } from "@/lib/domain/matching";
import { cn } from "@/lib/utils";
import { importOfferIntoApplicationAction, setOfferTextAction } from "@/actions/features";

export type OfferAnalysisData = {
  score: number | null;
  mine: string[];
  missing: string[];
  segments: Segment[];
};

/** Score de matching, compétences détectées et texte de l'offre surligné (fiche candidature). */
export function OfferAnalysis({
  applicationId,
  offerText,
  offerUrl,
  analysis,
}: {
  applicationId: number;
  offerText: string | null;
  offerUrl: string | null;
  analysis: OfferAnalysisData | null;
}) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(!offerText);
  const [draft, setDraft] = useState(offerText ?? "");

  const importButton = offerUrl && (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        run(() => importOfferIntoApplicationAction(applicationId), {
          success: "Offre importée depuis le lien",
          onSuccess: () => setEditing(false),
        })
      }
    >
      <Download /> Importer depuis le lien
    </Button>
  );

  return (
    <Panel
      title="Analyse de l'offre"
      actions={
        <>
          {importButton}
          {offerText && !editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(offerText ?? "");
                setEditing(true);
              }}
            >
              <Pencil /> Modifier
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" asChild title="Ma liste de compétences">
            <Link to="/reglages?onglet=mots-cles" aria-label="Ma liste de compétences">
              <Settings2 />
            </Link>
          </Button>
        </>
      }
    >
      {editing ? (
        <form
          className="grid gap-2 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setOfferTextAction(applicationId, draft), { success: "Offre analysée", onSuccess: () => setEditing(false) });
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            placeholder="Colle ici le texte complet de l'offre : les compétences de ta liste seront détectées et surlignées."
            className="text-xs leading-relaxed"
          />
          <div className="flex justify-end gap-2">
            {offerText && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            )}
            <Button type="submit" size="sm" disabled={pending || draft.trim() === (offerText ?? "")}>
              Analyser
            </Button>
          </div>
        </form>
      ) : (
        analysis && (
          <div className="grid gap-3 py-2">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div>
                <p className="text-3xl leading-none font-semibold tracking-tight">
                  {analysis.score === null ? "—" : `${Math.round(analysis.score * 100)} %`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {analysis.mine.length + analysis.missing.length
                    ? `${analysis.mine.length} sur ${analysis.mine.length + analysis.missing.length} compétences demandées`
                    : "Aucune compétence de ta liste détectée"}
                </p>
              </div>
              {analysis.score !== null && (
                <div className="h-1.5 min-w-32 flex-1 overflow-hidden rounded-full bg-viz-seq-1" aria-hidden>
                  <div className="h-full rounded-full bg-viz-1" style={{ width: `${analysis.score * 100}%` }} />
                </div>
              )}
            </div>
            {(analysis.mine.length > 0 || analysis.missing.length > 0) && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Compétences détectées">
                {analysis.mine.map((k) => (
                  <li key={k} className="flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                    <Check className="size-3" /> {k}
                  </li>
                ))}
                {analysis.missing.map((k) => (
                  <li
                    key={k}
                    title="Demandée par l'offre, pas (encore) dans tes compétences"
                    className="flex items-center gap-1 rounded-md border border-dashed border-amber-500/60 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300"
                  >
                    <CircleDashed className="size-3" /> {k}
                  </li>
                ))}
              </ul>
            )}
            <details open>
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Texte de l&apos;offre <span className="ml-2 text-emerald-700 dark:text-emerald-300">■ maîtrisé</span>{" "}
                <span className="text-amber-700 dark:text-amber-300">■ à travailler</span>
              </summary>
              <p className="mt-2 max-h-[30rem] overflow-auto rounded-md bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                {analysis.segments.map((s, i) =>
                  s.hit ? (
                    <mark
                      key={i}
                      title={s.hit.mine ? `${s.hit.label} : maîtrisé` : `${s.hit.label} : à travailler`}
                      className={cn(
                        "rounded-[3px] px-0.5 text-foreground",
                        s.hit.mine ? "bg-emerald-500/25" : "bg-amber-500/30",
                      )}
                    >
                      {s.text}
                    </mark>
                  ) : (
                    <span key={i}>{s.text}</span>
                  ),
                )}
              </p>
            </details>
          </div>
        )
      )}
    </Panel>
  );
}
