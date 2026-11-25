import { useState } from "react";
import { Field, OptionSelect } from "@/components/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { localDate } from "@/lib/dates";
import { DOCUMENT_KIND_LABELS, type DocumentKind } from "@/lib/domain/constants";
import { saveDocumentAction } from "@/actions/records";

export type DocumentOption = { id: number; label: string; kind: DocumentKind };

/**
 * Ajoute une version de CV / lettre. Depuis une fiche candidature, permet aussi de lier une
 * version existante, avec la date d'envoi : on sait toujours quelle version est partie où.
 */
export function DocumentDialog({
  applicationId,
  existing = [],
  trigger,
}: {
  applicationId?: number;
  existing?: DocumentOption[];
  trigger: React.ReactNode;
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "existing">("new");
  const [kind, setKind] = useState<DocumentKind>("cv");
  const [documentId, setDocumentId] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (applicationId) form.set("applicationId", String(applicationId));
    if (tab === "existing") {
      if (!documentId) return;
      form.set("documentId", documentId);
    } else {
      form.set("kind", kind);
    }
    run(() => saveDocumentAction(form), { success: "Document enregistré", onSuccess: () => setOpen(false) });
  }

  const canLinkExisting = Boolean(applicationId && existing.length);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setTab("new");
          setDocumentId(null);
        }
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{applicationId ? "Document envoyé" : "Nouvelle version de document"}</DialogTitle>
          <DialogDescription>Fichier (PDF, DOCX…) et/ou texte collé.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "new" | "existing")}>
            {canLinkExisting && (
              <TabsList>
                <TabsTrigger value="new">Nouvelle version</TabsTrigger>
                <TabsTrigger value="existing">Version existante</TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="new" className="grid gap-3">
              <div className="grid grid-cols-[140px_1fr] gap-3">
                <Field label="Type" htmlFor="doc-kind">
                  <OptionSelect id="doc-kind" value={kind} options={DOCUMENT_KIND_LABELS} onChange={(v) => setKind(v ?? "cv")} />
                </Field>
                <Field label="Libellé *" htmlFor="doc-label">
                  <Input id="doc-label" name="label" required={tab === "new"} placeholder="CV v3 — orienté NLP" />
                </Field>
              </div>
              <Field label="Fichier" htmlFor="doc-file">
                <Input id="doc-file" name="file" type="file" accept=".pdf,.doc,.docx,.md,.txt,.odt" />
              </Field>
              <Field label="Texte (lettres : sert au diff et aux prompts)" htmlFor="doc-content">
                <Textarea id="doc-content" name="content" rows={6} />
              </Field>
            </TabsContent>
            {canLinkExisting && (
              <TabsContent value="existing">
                <Field label="Version" htmlFor="doc-existing">
                  <OptionSelect
                    id="doc-existing"
                    value={documentId}
                    onChange={setDocumentId}
                    placeholder="Choisir…"
                    options={existing.map((d) => [String(d.id), `${DOCUMENT_KIND_LABELS[d.kind]} · ${d.label}`] as const)}
                  />
                </Field>
              </TabsContent>
            )}
          </Tabs>
          {applicationId && (
            <Field label="Envoyé le" htmlFor="doc-sentAt">
              <Input id="doc-sentAt" name="sentAt" type="date" defaultValue={localDate()} className="w-44" />
            </Field>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending || (tab === "existing" && !documentId)}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
