import { Check, ChevronDown, Copy, ExternalLink, Sparkles, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/clipboard";
import { renderTemplateAction } from "@/actions/features";
import type { RenderedTemplate } from "@/services/templates";

export const PROMPT_VARIANTS = [
  ["letter", "Lettre de motivation"],
  ["follow_up", "Email de relance"],
  ["thank_you", "Remerciement après entretien"],
  ["linkedin", "Message LinkedIn"],
  ["interview_prep", "Préparation d'entretien"],
] as const;

const HELP: Record<string, string> = {
  lettre_base: "ajoute ta lettre de base dans Documents",
  cv_base: "ajoute ton CV de base dans Documents",
  texte_offre: "colle le texte de l'offre",
  profil: "remplis ton profil dans Réglages",
  mon_nom: "renseigne ton nom dans Réglages",
  contact: "lie un contact à la candidature",
};

/** « Préparer un prompt » : prompt rempli avec la candidature, relu puis copié pour Claude. */
export function PromptButton({ applicationId, variant }: { applicationId: number; variant?: string }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<RenderedTemplate | null>(null);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  async function open(key: string) {
    setCurrent(key);
    setPrompt(null);
    const res = await renderTemplateAction("prompt", key, applicationId);
    if (!res.ok) {
      toast.error(res.error);
      setCurrent(null);
      return;
    }
    setPrompt(res.data);
    setText(res.data.body);
  }

  async function copy(thenOpenClaude: boolean) {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Prompt copié", { description: thenOpenClaude ? "Colle-le dans la conversation (Ctrl+V)." : undefined });
    if (thenOpenClaude) window.open("https://claude.ai/new", "_blank", "noopener");
  }

  return (
    <>
      {variant ? (
        <Button variant="outline" size="sm" onClick={() => open(variant)}>
          <Sparkles /> Prompt pour Claude
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Sparkles /> Prompt pour Claude <ChevronDown className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Préparer un prompt</DropdownMenuLabel>
            {PROMPT_VARIANTS.map(([key, label]) => (
              <DropdownMenuItem key={key} onSelect={() => open(key)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={current !== null} onOpenChange={(o) => !o && setCurrent(null)}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prompt · {PROMPT_VARIANTS.find(([k]) => k === current)?.[1]}</DialogTitle>
            <DialogDescription>
              Relis-le (tu peux le modifier), puis colle-le dans Claude. Modèle modifiable dans{" "}
              <Link to="/reglages?onglet=gabarits" className="underline">
                Réglages → Gabarits
              </Link>
              .
            </DialogDescription>
          </DialogHeader>
          {!prompt ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <div className="grid gap-3">
              {prompt.missing.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <ul>
                    {prompt.missing.map((m) => (
                      <li key={m}>
                        <code>[{m}]</code> est vide{HELP[m] ? ` : ${HELP[m]}` : ""}.
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={18} className="font-mono text-xs leading-relaxed" />
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => copy(false)}>
                  {copied ? <Check /> : <Copy />} Copier
                </Button>
                <Button size="sm" onClick={() => copy(true)}>
                  <ExternalLink /> Copier et ouvrir Claude
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
