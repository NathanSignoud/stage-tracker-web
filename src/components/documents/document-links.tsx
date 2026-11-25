import { Download, Eye, Paperclip, X } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAction } from "@/components/use-action";
import { formatDay } from "@/lib/dates";
import { DOCUMENT_KIND_LABELS } from "@/lib/domain/constants";
import type { Document } from "@/lib/types";
import { attachDocumentFileAction, unlinkDocumentAction } from "@/actions/records";
import { errorMessage } from "@/actions/result";
import { downloadBlob } from "@/lib/download";
import { ACCEPTED_EXTENSIONS } from "@/lib/text-extraction";
import { downloadDocumentFile } from "@/services/documents";
import { toast } from "sonner";

/** Joint un fichier à une version qui n'en a pas (ex. documents importés de la version locale). */
function AttachFileButton({ documentId, hint }: { documentId: number; hint: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const { pending, run } = useAction();
  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={pending}
        aria-label="Joindre le fichier"
        title={hint ? `Joindre le fichier (${hint})` : "Joindre le fichier"}
        onClick={() => input.current?.click()}
      >
        <Paperclip />
      </Button>
      <input
        ref={input}
        type="file"
        hidden
        accept={ACCEPTED_EXTENSIONS.join(",")}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) run(() => attachDocumentFileAction(documentId, file), { success: "Fichier joint" });
        }}
      />
    </>
  );
}

export function DocumentButtons({ doc }: { doc: Pick<Document, "id" | "label" | "content" | "filePath" | "fileName"> }) {
  return (
    <>
      {doc.content && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Voir le texte" title="Voir le texte">
              <Eye />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{doc.label}</DialogTitle>
            </DialogHeader>
            <pre className="font-sans text-[13px] leading-relaxed whitespace-pre-wrap">{doc.content}</pre>
          </DialogContent>
        </Dialog>
      )}
      {!doc.filePath && <AttachFileButton documentId={doc.id} hint={doc.fileName} />}
      {doc.filePath && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Télécharger ${doc.fileName ?? ""}`}
          title={doc.fileName ?? "Télécharger"}
          onClick={() =>
            downloadDocumentFile(doc)
              .then((blob) => downloadBlob(doc.fileName ?? "document", blob))
              .catch((e: unknown) => toast.error(errorMessage(e)))
          }
        >
          <Download />
        </Button>
      )}
    </>
  );
}

export function LinkedDocumentsList({
  applicationId,
  documents,
}: {
  applicationId: number;
  documents: (Document & { sentAt: string | null })[];
}) {
  const { pending, run } = useAction();
  if (!documents.length) return <p className="py-2 text-[13px] text-muted-foreground">Aucun document lié.</p>;
  return (
    <ul className="divide-y">
      {documents.map((d) => (
        <li key={d.id} className="group flex items-center gap-2 py-2">
          <span className="w-14 shrink-0 text-[11px] text-muted-foreground uppercase">{DOCUMENT_KIND_LABELS[d.kind].split(" ")[0]}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate">{d.label}</p>
            {d.sentAt && <p className="text-xs text-muted-foreground">Envoyé le {formatDay(d.sentAt)}</p>}
          </div>
          <DocumentButtons doc={d} />
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={pending}
            aria-label="Délier"
            title="Délier de cette candidature (la version est conservée)"
            className="opacity-50 group-hover:opacity-100"
            onClick={() => run(() => unlinkDocumentAction(applicationId, d.id))}
          >
            <X />
          </Button>
        </li>
      ))}
    </ul>
  );
}
