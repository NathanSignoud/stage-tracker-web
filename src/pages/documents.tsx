import { FilePlus, Star } from "lucide-react";
import { SetBaseButton } from "@/components/documents/base-actions";
import { Link } from "react-router";
import { DocumentDialog } from "@/components/documents/document-dialog";
import { DocumentButtons } from "@/components/documents/document-links";
import { PageHeader, Panel } from "@/components/page-header";
import { TrashButton } from "@/components/trash-buttons";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageLoading } from "@/components/page-loading";
import { useData } from "@/lib/data";
import { formatDay, isoToLocalDate } from "@/lib/dates";
import { DOCUMENT_KIND_LABELS } from "@/lib/domain/constants";
import { getBaseDocument, listDocuments } from "@/services/documents";

async function loadDocuments() {
  const [docs, cv, letter] = await Promise.all([listDocuments(), getBaseDocument("cv"), getBaseDocument("letter")]);
  return { docs, bases: [{ kind: "cv" as const, doc: cv }, { kind: "letter" as const, doc: letter }] };
}

export function DocumentsPage() {
  const { data, error } = useData(loadDocuments);
  if (!data) return <PageLoading error={error} />;
  const { docs, bases } = data;
  return (
    <div className="mx-auto max-w-5xl">
      <title>Documents · Stage Tracker</title>
      <PageHeader
        title="Documents"
        description="Versions de CV et de lettres, et à qui chacune a été envoyée."
        actions={
          <>
            <DocumentDialog
              trigger={
                <Button variant="outline" size="sm">
                  <FilePlus /> Nouvelle version
                </Button>
              }
            />
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        {bases.map(({ kind, doc }) => (
          <Panel key={kind} title={`${kind === "cv" ? "CV" : "Lettre de motivation"} de base`}>
            {doc ? (
              <div className="flex items-center gap-2 py-2">
                <Star className="size-4 shrink-0 fill-amber-400 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{doc.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.content ? `${doc.content.length.toLocaleString("fr-FR")} caractères de texte` : "Pas de texte : ajoute-le pour les prompts"}
                    {doc.fileName && ` · ${doc.fileName}`}
                  </p>
                </div>
                <DocumentButtons doc={doc} />
              </div>
            ) : (
              <p className="py-2 text-[13px] text-muted-foreground">
                Aucune. Ajoute une version (bouton « Nouvelle version ») puis clique sur <Star className="inline size-3" /> pour en faire la
                version de base.
              </p>
            )}
          </Panel>
        ))}
      </div>
      <div className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-9 text-xs">Type</TableHead>
              <TableHead className="h-9 text-xs">Version</TableHead>
              <TableHead className="h-9 text-xs">Créée le</TableHead>
              <TableHead className="h-9 text-xs">Envoyée à</TableHead>
              <TableHead className="h-9 w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="py-2 text-xs text-muted-foreground">{DOCUMENT_KIND_LABELS[d.kind]}</TableCell>
                <TableCell className="py-2">
                  <p className="font-medium">
                    {d.label}
                    {d.isBase && (
                      <span className="ml-2 rounded bg-amber-500/15 px-1.5 text-[11px] font-normal text-amber-700 dark:text-amber-300">base</span>
                    )}
                  </p>
                  {d.fileName && <p className="text-xs text-muted-foreground">{d.fileName}</p>}
                </TableCell>
                <TableCell className="py-2 tabular-nums">{formatDay(isoToLocalDate(d.createdAt))}</TableCell>
                <TableCell className="py-2">
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[13px]">
                    {d.sentTo.length === 0 && <span className="text-muted-foreground">—</span>}
                    {d.sentTo.map((a) => (
                      <Link key={a.id} to={`/candidatures/${a.id}`} className="hover:underline">
                        {a.company}
                        {a.sentAt && <span className="text-xs text-muted-foreground"> ({formatDay(a.sentAt, "d MMM")})</span>}
                      </Link>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex justify-end gap-0.5">
                    {!d.isBase && d.kind !== "other" && <SetBaseButton documentId={d.id} />}
                    <DocumentButtons doc={d} />
                    <TrashButton kind="document" id={d.id} label={d.label} iconOnly />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {docs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Aucun document. Ajoute ton CV et ta lettre, puis lie chaque version aux candidatures concernées.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
