import { ArchiveRestore, Trash2 } from "lucide-react";
import { useNavigate } from "react-router";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { moveToTrashAction, restoreFromTrashAction } from "@/actions/records";
import type { TrashKind } from "@/lib/domain/constants";

/** Bouton « Supprimer » : confirmation puis mise à la corbeille (jamais de suppression directe). */
export function TrashButton({
  kind,
  id,
  label,
  redirectTo,
  iconOnly = false,
}: {
  kind: TrashKind;
  id: number;
  label: string;
  redirectTo?: string;
  iconOnly?: boolean;
}) {
  const navigate = useNavigate();
  const { pending, run } = useAction();
  return (
    <ConfirmButton
      title={`Mettre « ${label} » à la corbeille ?`}
      description="Tu pourras la restaurer depuis la corbeille."
      confirmLabel="Mettre à la corbeille"
      destructive
      onConfirm={() =>
        run(() => moveToTrashAction(kind, id), {
          success: "Mis à la corbeille",
          onSuccess: () => redirectTo && navigate(redirectTo),
        })
      }
    >
      {iconOnly ? (
        <Button variant="ghost" size="icon-xs" disabled={pending} aria-label="Mettre à la corbeille">
          <Trash2 />
        </Button>
      ) : (
        <Button variant="ghost" size="sm" disabled={pending}>
          <Trash2 /> Supprimer
        </Button>
      )}
    </ConfirmButton>
  );
}

export function RestoreBanner({ kind, id }: { kind: TrashKind; id: number }) {
  const { pending, run } = useAction();
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px]">
      <Trash2 className="size-4 text-amber-500" />
      <span className="flex-1">Cet élément est dans la corbeille.</span>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => restoreFromTrashAction(kind, id), { success: "Restauré" })}>
        <ArchiveRestore /> Restaurer
      </Button>
    </div>
  );
}
