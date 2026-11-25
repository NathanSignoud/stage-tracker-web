import { diffWords } from "diff";
import { FileDown, Save, Upload } from "lucide-react";
import { Link } from "react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { formatDayTime, localDateTime } from "@/lib/dates";
import { downloadLetter } from "@/lib/letter-download";
import { cn } from "@/lib/utils";
import { saveLetterVersionAction } from "@/actions/features";

type Version = { id: number; label: string; content: string | null; createdAt: string; sentAt: string | null };

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function LetterEditor({
  applicationId,
  company,
  baseText,
  versions,
}: {
  applicationId: number;
  company: string;
  baseText: string | null;
  versions: Version[];
}) {
  const { pending, run } = useAction();
  const [text, setText] = useState(versions[0]?.content ?? "");
  const [loadedId, setLoadedId] = useState<number | null>(versions[0]?.id ?? null);
  const loaded = versions.find((v) => v.id === loadedId);
  const unchanged = text.trim() === (loaded?.content ?? "").trim();

  const diff = useMemo(() => (baseText && text.trim() ? diffWords(baseText, text) : null), [baseText, text]);
  const added = diff?.filter((p) => p.added).reduce((n, p) => n + words(p.value), 0) ?? 0;
  const removed = diff?.filter((p) => p.removed).reduce((n, p) => n + words(p.value), 0) ?? 0;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={`Ma lettre pour ${company}`}
          actions={<span className="text-xs text-muted-foreground">{words(text)} mots</span>}
        >
          <div className="grid gap-2 py-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={22}
              placeholder="Colle ici la version finale de ta lettre (par exemple celle rédigée avec Claude)."
              className="text-[13px] leading-relaxed"
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              {loaded && unchanged && <span className="mr-auto text-xs text-muted-foreground">Affiche : {loaded.label}</span>}
              <Button
                size="sm"
                disabled={pending || !text.trim() || unchanged}
                onClick={() =>
                  run(() => saveLetterVersionAction(applicationId, text), {
                    success: "Nouvelle version enregistrée et liée à la candidature",
                    onSuccess: (id) => setLoadedId(id),
                  })
                }
              >
                <Save /> Enregistrer comme nouvelle version
              </Button>
            </div>
          </div>
        </Panel>

        <Panel
          title="Différences avec ma lettre de base"
          actions={
            diff && (
              <span className="text-xs text-muted-foreground">
                <span className="text-emerald-700 dark:text-emerald-300">+{added}</span> /{" "}
                <span className="text-rose-700 dark:text-rose-300">−{removed}</span> mots
              </span>
            )
          }
        >
          {!baseText ? (
            <p className="py-3 text-[13px] text-muted-foreground">
              Pas encore de lettre de base. Ajoute-la dans{" "}
              <Link to="/documents" className="underline">
                Documents
              </Link>{" "}
              (bouton « Définir comme base », ou dépose-la dans <code className="text-xs">data/base/</code>).
            </p>
          ) : !diff ? (
            <p className="py-3 text-[13px] text-muted-foreground">Colle ta lettre à gauche pour voir ce qui a changé.</p>
          ) : (
            <div className="grid gap-2 py-2">
              <p className="flex gap-3 text-xs text-muted-foreground">
                <span className="rounded bg-emerald-500/20 px-1 text-foreground">ajouté</span>
                <span className="rounded bg-rose-500/15 px-1 text-foreground line-through">retiré</span>
              </p>
              <p className="max-h-[34rem] overflow-auto rounded-md bg-muted/50 p-3 text-[13px] leading-relaxed whitespace-pre-wrap">
                {diff.map((part, i) => (
                  <span
                    key={i}
                    className={cn(
                      part.added && "rounded-[3px] bg-emerald-500/20",
                      part.removed && "rounded-[3px] bg-rose-500/15 text-muted-foreground line-through",
                    )}
                  >
                    {part.value}
                  </span>
                ))}
              </p>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Versions envoyées ou préparées" count={versions.length} empty="Aucune version pour l'instant.">
        <ul className="divide-y">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{v.label}</p>
                <p className="text-xs text-muted-foreground">
                  Créée {formatDayTime(localDateTime(new Date(v.createdAt)))}
                  {v.sentAt ? ` · envoyée le ${formatDayTime(v.sentAt)}` : " · pas encore marquée comme envoyée"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={v.id === loadedId && unchanged}
                onClick={() => {
                  setText(v.content ?? "");
                  setLoadedId(v.id);
                }}
              >
                <Upload /> Charger
              </Button>
              {(["docx", "pdf"] as const).map((format) => (
                <Button
                  key={format}
                  variant="outline"
                  size="sm"
                  onClick={() => downloadLetter(v.id, format).catch((e: Error) => toast.error(e.message))}
                >
                  <FileDown /> {format.toUpperCase()}
                </Button>
              ))}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
