import { ClipboardCopy, ExternalLink, FileUp, ListPlus, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { copyText } from "@/lib/clipboard";
import { companyKey, parseCompanyList, type CompanyField, type ListFormat } from "@/lib/domain/company-import";
import { cn } from "@/lib/utils";
import { companyResearchPromptAction, importCompaniesAction } from "@/actions/companies";

const FORMAT_LABELS: Record<ListFormat, string> = {
  markdown: "tableau Markdown",
  csv: "CSV",
  tsv: "copie de tableur",
  json: "JSON",
  lines: "liste",
};
const FIELD_LABELS: Record<CompanyField, string> = {
  name: "nom",
  careersUrl: "site carrière",
  location: "localisation",
  sector: "secteur",
  notes: "notes",
};

const domain = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/** Import d'une liste d'entreprises (réponse de Claude collée, ou fichier CSV / texte). */
export function ImportCompaniesDialog({ existingNames }: { existingNames: string[] }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [createApplications, setCreateApplications] = useState(false);
  const parsed = useMemo(() => parseCompanyList(text), [text]);
  const existing = useMemo(() => new Set(existingNames.map(companyKey)), [existingNames]);
  const selected = parsed.rows.filter((_, i) => !excluded.has(i));

  function changeText(value: string) {
    setText(value);
    setExcluded(new Set());
  }

  async function copyPrompt(openClaude: boolean) {
    const res = await companyResearchPromptAction();
    if (!res.ok) return toast.error(res.error);
    await copyText(res.data.body);
    toast.success("Prompt de recherche copié", {
      description: res.data.missing.includes("profil")
        ? "Ton profil est vide (Réglages → Profil) : Claude manquera de critères."
        : "Colle-le dans Claude, puis colle sa réponse ici.",
    });
    if (openClaude) window.open("https://claude.ai/new", "_blank", "noopener");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) changeText("");
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <ListPlus /> Importer une liste
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Importer une liste d&apos;entreprises</DialogTitle>
          <DialogDescription>
            Tableau ou liste produit par Claude, CSV, copie depuis Excel / Sheets : les colonnes sont reconnues
            automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <section className="grid gap-2 rounded-lg border p-3">
            <h3 className="text-[13px] font-medium">1. Demande la liste à Claude</h3>
            <p className="text-xs text-muted-foreground">
              Le prompt reprend ton profil, exclut les entreprises que tu as déjà et demande le bon format (modifiable dans
              Réglages → Gabarits).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => copyPrompt(false)}>
                <ClipboardCopy /> Copier le prompt de recherche
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyPrompt(true)}>
                <ExternalLink /> Copier et ouvrir Claude
              </Button>
            </div>
          </section>

          <section className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-medium">2. Colle sa réponse</h3>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <FileUp className="size-3.5" /> ou choisir un fichier (.csv, .tsv, .txt, .md, .json)
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.md,.json,text/plain,text/csv"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) changeText(await file.text());
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <Textarea
              value={text}
              onChange={(e) => changeText(e.target.value)}
              rows={7}
              placeholder={"entreprise;site_carriere;localisation;secteur;notes\nMistral AI;https://mistral.ai/careers;Paris;IA générative;LLM open source"}
              className="font-mono text-xs"
            />
          </section>

          {text.trim() && (
            <section className="grid gap-2">
              <p className="text-xs text-muted-foreground">
                {parsed.format ? `Format détecté : ${FORMAT_LABELS[parsed.format]}` : "Format non reconnu"} ·{" "}
                <b className="text-foreground">{parsed.rows.length}</b> entreprise{parsed.rows.length > 1 ? "s" : ""}
                {Object.keys(parsed.columns).length > 0 &&
                  ` · colonnes : ${Object.entries(parsed.columns)
                    .map(([field, header]) => `${header} → ${FIELD_LABELS[field as CompanyField]}`)
                    .join(", ")}`}
              </p>
              {parsed.skipped.length > 0 && (
                <ul className="grid gap-0.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  {parsed.skipped.map((s) => (
                    <li key={`${s.line}-${s.reason}`} className="flex items-center gap-1.5">
                      <TriangleAlert className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                      Ligne {s.line} : {s.reason}
                    </li>
                  ))}
                </ul>
              )}
              {parsed.rows.length > 0 && (
                <div className="max-h-80 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-8 w-8">
                          <Checkbox
                            aria-label="Tout sélectionner"
                            checked={excluded.size === 0 ? true : excluded.size === parsed.rows.length ? false : "indeterminate"}
                            onCheckedChange={(v) => setExcluded(v === true ? new Set() : new Set(parsed.rows.map((_, i) => i)))}
                          />
                        </TableHead>
                        <TableHead className="h-8 text-xs">Entreprise</TableHead>
                        <TableHead className="h-8 text-xs">Site carrière</TableHead>
                        <TableHead className="h-8 text-xs">Localisation</TableHead>
                        <TableHead className="h-8 text-xs">Secteur</TableHead>
                        <TableHead className="h-8 text-xs">Notes</TableHead>
                        <TableHead className="h-8 text-xs">État</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.rows.map((row, i) => {
                        const known = existing.has(companyKey(row.name));
                        return (
                          <TableRow key={`${i}-${row.name}`} className={cn(excluded.has(i) && "opacity-40")}>
                            <TableCell className="py-1.5">
                              <Checkbox
                                aria-label={`Importer ${row.name}`}
                                checked={!excluded.has(i)}
                                onCheckedChange={(v) =>
                                  setExcluded((prev) => {
                                    const next = new Set(prev);
                                    if (v === true) next.delete(i);
                                    else next.add(i);
                                    return next;
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell className="py-1.5 font-medium">{row.name}</TableCell>
                            <TableCell className="max-w-48 truncate py-1.5 text-xs">
                              {row.careersUrl ? (
                                <a href={row.careersUrl} target="_blank" rel="noreferrer" className="hover:underline">
                                  {domain(row.careersUrl)}
                                </a>
                              ) : (
                                <span className="text-amber-700 dark:text-amber-300">manquant</span>
                              )}
                            </TableCell>
                            <TableCell className="py-1.5 text-xs">{row.location}</TableCell>
                            <TableCell className="py-1.5 text-xs">{row.sector}</TableCell>
                            <TableCell className="max-w-64 truncate py-1.5 text-xs text-muted-foreground" title={row.notes ?? undefined}>
                              {row.notes}
                            </TableCell>
                            <TableCell className="py-1.5 text-xs whitespace-nowrap">
                              {known ? (
                                <span className="text-muted-foreground" title="Déjà dans ta liste : seuls les champs vides seront complétés">
                                  déjà connue
                                </span>
                              ) : (
                                <span className="text-emerald-700 dark:text-emerald-300">nouvelle</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          )}
        </div>

        <DialogFooter className="items-center gap-3 sm:justify-between">
          <label className="flex items-center gap-2 text-[13px]">
            <Checkbox checked={createApplications} onCheckedChange={(v) => setCreateApplications(v === true)} />
            Créer aussi une candidature « À explorer » pour chacune (Kanban)
          </label>
          <Button
            disabled={pending || selected.length === 0}
            onClick={() =>
              run(() => importCompaniesAction(selected, { createApplications }), {
                onSuccess: (r) => {
                  toast.success(`${r.created} entreprise${r.created > 1 ? "s" : ""} ajoutée${r.created > 1 ? "s" : ""}`, {
                    description: [
                      r.completed && `${r.completed} déjà connue(s), complétée(s)`,
                      r.unchanged && `${r.unchanged} déjà à jour`,
                      r.applicationsCreated && `${r.applicationsCreated} candidature(s) « À explorer » créée(s)`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined,
                  });
                  changeText("");
                  setOpen(false);
                },
              })
            }
          >
            Importer {selected.length} entreprise{selected.length > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
