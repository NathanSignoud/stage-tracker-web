import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { setBaseDocumentAction } from "@/actions/features";

export function SetBaseButton({ documentId }: { documentId: number }) {
  const { pending, run } = useAction();
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      disabled={pending}
      aria-label="Définir comme version de base"
      title="Définir comme version de base (prompts, diff des lettres)"
      onClick={() => run(() => setBaseDocumentAction(documentId), { success: "Version de base mise à jour" })}
    >
      <Star />
    </Button>
  );
}
