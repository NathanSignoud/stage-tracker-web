import { ArchiveRestore, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { formatDayTime, localDateTime } from "@/lib/dates";
import { purgeFromTrashAction, restoreFromTrashAction } from "@/actions/records";
import { TRASH_KIND_LABELS } from "@/lib/domain/constants";
import type { TrashItem } from "@/services/trash";

const LINKS: Partial<Record<TrashItem["kind"], string>> = { application: "/candidatures/", contact: "/contacts/" };

export function TrashList({ items }: { items: TrashItem[] }) {
  const { pending, run } = useAction();
  if (!items.length) return <p className="py-10 text-center text-[13px] text-muted-foreground">La corbeille est vide.</p>;

  return (
    <ul className="divide-y rounded-3xl bg-card ring-1 ring-border">
      {items.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center gap-3 px-3.5 py-2">
          <span className="w-24 shrink-0 text-xs text-muted-foreground">{TRASH_KIND_LABELS[item.kind]}</span>
          <div className="min-w-0 flex-1">
            {LINKS[item.kind] ? (
              <Link to={`${LINKS[item.kind]}${item.id}`} className="font-medium hover:underline">
                {item.label}
              </Link>
            ) : (
              <p className="truncate font-medium">{item.label}</p>
            )}
            {item.detail && <p className="truncate text-xs text-muted-foreground">{item.detail}</p>}
          </div>
          <span className="text-xs text-muted-foreground">{formatDayTime(localDateTime(new Date(item.deletedAt)))}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => restoreFromTrashAction(item.kind, item.id), { success: "Restauré" })}
          >
            <ArchiveRestore /> Restaurer
          </Button>
          <ConfirmButton
            title="Supprimer définitivement ?"
            description={`« ${item.label} » sera effacé pour de bon${item.kind === "application" ? ", avec ses échanges, tâches et son historique" : ""}. Cette action est irréversible.`}
            confirmLabel="Supprimer définitivement"
            destructive
            onConfirm={() => run(() => purgeFromTrashAction(item.kind, item.id), { success: "Supprimé définitivement" })}
          >
            <Button variant="ghost" size="sm" disabled={pending} className="text-destructive">
              <Trash2 /> Supprimer
            </Button>
          </ConfirmButton>
        </li>
      ))}
    </ul>
  );
}
