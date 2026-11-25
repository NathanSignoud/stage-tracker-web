import { Eye, Layers, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAction } from "@/components/use-action";
import { flashcardOrder } from "@/lib/domain/prep";
import { cn } from "@/lib/utils";
import { reviewPrepQuestionAction } from "@/actions/features";
import type { PrepQuestion } from "@/lib/types";

export const CONFIDENCE = [
  { value: 0, label: "À revoir", key: "1", className: "border-rose-500/50 text-rose-700 dark:text-rose-300" },
  { value: 1, label: "Bien", key: "2", className: "border-amber-500/50 text-amber-700 dark:text-amber-300" },
  { value: 2, label: "Parfait", key: "3", className: "border-emerald-500/50 text-emerald-700 dark:text-emerald-300" },
] as const;

/** Entraînement : les questions les moins maîtrisées d'abord ; Espace = réponse, 1/2/3 = auto-évaluation. */
export function Flashcards({ questions }: { questions: PrepQuestion[] }) {
  const [open, setOpen] = useState(false);
  const [deck, setDeck] = useState<PrepQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState<number[]>([]);
  const { run } = useAction();
  const available = flashcardOrder(questions).length;

  function start() {
    setDeck(flashcardOrder(questions));
    setIndex(0);
    setRevealed(false);
    setRatings([]);
  }

  const card = deck[index];
  const done = open && deck.length > 0 && index >= deck.length;

  function rate(confidence: 0 | 1 | 2) {
    if (!card) return;
    run(() => reviewPrepQuestionAction(card.id, confidence));
    setRatings((r) => [...r, confidence]);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  useEffect(() => {
    if (!open || !card) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === " " && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3"].includes(e.key)) rate((Number(e.key) - 1) as 0 | 1 | 2);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) start();
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={available === 0} title={available ? undefined : "Ajoute d'abord des questions « qu'on va me poser »"}>
          <Layers /> S&apos;entraîner ({available})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Flashcards</DialogTitle>
          <DialogDescription>
            {done ? "Session terminée" : `${Math.min(index + 1, deck.length)} / ${deck.length} · réponds à voix haute, puis compare.`}
          </DialogDescription>
        </DialogHeader>

        {card && (
          <div className="grid gap-4">
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-viz-1 transition-all" style={{ width: `${(index / deck.length) * 100}%` }} />
            </div>
            <p className="min-h-20 text-lg leading-snug font-medium">{card.question}</p>
            {revealed ? (
              <>
                <div className="max-h-72 overflow-auto rounded-lg bg-muted/50 p-3 text-[13px] leading-relaxed whitespace-pre-wrap">
                  {card.answer || <span className="text-muted-foreground">Pas encore de réponse écrite pour cette question.</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {CONFIDENCE.map((c) => (
                    <Button key={c.value} variant="outline" className={cn("h-11", c.className)} onClick={() => rate(c.value)}>
                      {c.label}
                      <kbd className="ml-1 hidden font-mono text-[10px] opacity-60 sm:inline">{c.key}</kbd>
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <Button className="h-11" onClick={() => setRevealed(true)}>
                <Eye /> Afficher ma réponse <kbd className="ml-1 hidden font-mono text-[10px] opacity-60 sm:inline">Espace</kbd>
              </Button>
            )}
          </div>
        )}

        {done && (
          <div className="grid gap-4 text-center">
            <div className="grid grid-cols-3 gap-2">
              {CONFIDENCE.map((c) => (
                <div key={c.value} className={cn("rounded-lg border px-2 py-3", c.className)}>
                  <p className="text-2xl font-semibold text-foreground">{ratings.filter((r) => r === c.value).length}</p>
                  <p className="text-xs">{c.label}</p>
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={start}>
              <RotateCcw /> Recommencer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
