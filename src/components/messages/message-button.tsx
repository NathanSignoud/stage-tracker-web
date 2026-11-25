import { Mail, PenLine } from "lucide-react";
import { useUi } from "@/components/ui-state";
import { Button } from "@/components/ui/button";

/** Ouvre le dialogue global « Rédiger un message » pour une candidature. */
export function MessageButton({
  applicationId,
  templateKey,
  compact = false,
  label = "Rédiger",
}: {
  applicationId: number;
  templateKey?: string;
  compact?: boolean;
  /** Libellé du bouton compact. */
  label?: string;
}) {
  const { setMessageTarget } = useUi();
  const open = () => setMessageTarget({ applicationId, templateKey });
  return compact ? (
    <Button size="xs" variant="outline" onClick={open} title="Rédiger le message (modèle pré-rempli)">
      <PenLine /> {label}
    </Button>
  ) : (
    <Button size="sm" variant="outline" onClick={open}>
      <Mail /> Message
    </Button>
  );
}
