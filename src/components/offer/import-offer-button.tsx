import { Loader2, Wand2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ImportedOffer } from "@/lib/domain/offer-parsing";
import { importOfferAction } from "@/actions/features";

/** « Remplir depuis le lien » : lit la page de l'offre et renvoie ce qui a été trouvé. */
export function ImportOfferButton({ url, onImported }: { url: string; onImported: (offer: ImportedOffer) => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending || !/^https?:\/\/\S+\.\S+/.test(url.trim())}
      title="Lit la page de l'offre et pré-remplit les champs"
      onClick={() =>
        startTransition(async () => {
          const res = await importOfferAction(url);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          onImported(res.data);
          const found = [
            res.data.title && "poste",
            res.data.company && "entreprise",
            res.data.location && "lieu",
            res.data.deadline && "date limite",
            res.data.offerText && `texte (${res.data.offerText.length.toLocaleString("fr-FR")} car.)`,
          ].filter(Boolean);
          toast.success("Offre lue", { description: found.length ? `Trouvé : ${found.join(", ")}.` : undefined });
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Wand2 />} Remplir depuis le lien
    </Button>
  );
}
