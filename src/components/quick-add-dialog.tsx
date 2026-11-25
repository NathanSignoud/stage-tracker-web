import { useNavigate } from "react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Field, OptionSelect } from "@/components/field";
import { useUi } from "@/components/ui-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImportOfferButton } from "@/components/offer/import-offer-button";
import type { RemoteMode } from "@/lib/domain/constants";
import { useAction } from "@/components/use-action";
import { PRIORITY_LABELS, STATUS_LABELS, type Priority, type Status } from "@/lib/domain/constants";
import { quickAddApplicationAction } from "@/actions/applications";
import { cn } from "@/lib/utils";

const EMPTY = {
  company: "",
  title: "",
  offerUrl: "",
  status: "to_explore" as Status,
  priority: 2 as Priority,
  // Remplis par « Remplir depuis le lien ».
  offerText: null as string | null,
  location: null as string | null,
  deadline: null as string | null,
  remote: null as RemoteMode | null,
};

/** Ajout rapide (touche N) : l'essentiel en 10 secondes, le reste plus tard dans la fiche. */
export function QuickAddDialog() {
  const { quickAddOpen, setQuickAddOpen } = useUi();
  const navigate = useNavigate();
  const { pending, run } = useAction();
  const [form, setForm] = useState(EMPTY);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(() => quickAddApplicationAction(form), {
      onSuccess: (id) => {
        toast.success(`${form.company} ajoutée`, {
          action: { label: "Ouvrir", onClick: () => navigate(`/candidatures/${id}`) },
        });
        setForm(EMPTY);
        setQuickAddOpen(false);
      },
    });
  }

  return (
    <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouvelle candidature</DialogTitle>
          <DialogDescription>L&apos;essentiel maintenant, le reste plus tard dans la fiche.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Entreprise *" htmlFor="qa-company">
            <Input
              id="qa-company"
              autoFocus
              required
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </Field>
          <Field label="Poste" htmlFor="qa-title">
            <Input id="qa-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Lien de l'offre" htmlFor="qa-url">
            <div className="flex gap-2">
              <Input
                id="qa-url"
                type="url"
                placeholder="https://…"
                value={form.offerUrl}
                onChange={(e) => setForm({ ...form, offerUrl: e.target.value })}
              />
              <ImportOfferButton
                url={form.offerUrl}
                onImported={(o) =>
                  setForm((f) => ({
                    ...f,
                    company: f.company || o.company || "",
                    title: f.title || o.title || "",
                    offerText: o.offerText,
                    location: o.location,
                    deadline: o.deadline,
                    remote: o.remote,
                  }))
                }
              />
            </div>
          </Field>
          {form.offerText && (
            <p className="-mt-1 text-xs text-muted-foreground">
              Texte de l&apos;offre importé ({form.offerText.length.toLocaleString("fr-FR")} caractères) : il sera analysé à
              l&apos;ajout.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Statut" htmlFor="qa-status">
              <OptionSelect
                id="qa-status"
                value={form.status}
                options={STATUS_LABELS}
                onChange={(status) => setForm({ ...form, status: status ?? "to_explore" })}
              />
            </Field>
            <Field label="Priorité">
              <div className="flex h-8 rounded-md border p-0.5">
                {([1, 2, 3] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    title={PRIORITY_LABELS[p]}
                    onClick={() => setForm({ ...form, priority: p })}
                    className={cn(
                      "flex-1 rounded-[5px] font-mono text-xs text-muted-foreground",
                      form.priority === p && "bg-muted font-semibold text-foreground",
                    )}
                  >
                    P{p}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !form.company.trim()}>
              Ajouter
              <kbd className="ml-1 rounded bg-primary-foreground/15 px-1 font-mono text-[10px]">↵</kbd>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
