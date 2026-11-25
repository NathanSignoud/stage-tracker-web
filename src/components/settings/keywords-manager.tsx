import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { Panel } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/use-action";
import { normalizeText } from "@/lib/text";
import { cn } from "@/lib/utils";
import { createKeywordAction, deleteKeywordAction, updateKeywordAction } from "@/actions/features";
import type { Keyword } from "@/lib/types";

const splitAliases = (s: string) => s.split(",").map((a) => a.trim()).filter(Boolean);

/** Liste des compétences du matching : coche ce que tu maîtrises (numérateur du score). */
export function KeywordsManager({ keywords }: { keywords: Keyword[] }) {
  const { pending, run } = useAction();
  const [filter, setFilter] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [aliases, setAliases] = useState("");
  const categories = useMemo(() => [...new Set(keywords.map((k) => k.category ?? "Autres"))], [keywords]);
  const q = normalizeText(filter.trim());
  const visible = keywords.filter((k) => !q || normalizeText([k.label, ...k.aliases].join(" ")).includes(q));
  const mineCount = keywords.filter((k) => k.mine).length;

  return (
    <div className="grid gap-4">
      <Panel title="Ajouter une compétence">
        <form
          className="grid gap-2 py-2 sm:grid-cols-[1fr_180px_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createKeywordAction({ label, category, aliases: splitAliases(aliases), mine: true }), {
              success: `${label} ajouté (coché comme maîtrisé)`,
              onSuccess: () => {
                setLabel("");
                setAliases("");
              },
            });
          }}
        >
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Hugging Face" className="h-8" aria-label="Compétence" />
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Catégorie" list="kw-categories" className="h-8" aria-label="Catégorie" />
          <datalist id="kw-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Variantes, séparées par des virgules" className="h-8" aria-label="Variantes" />
          <Button type="submit" size="sm" disabled={pending || !label.trim()}>
            <Plus /> Ajouter
          </Button>
        </form>
      </Panel>

      <Panel
        title="Mes compétences"
        actions={<span className="text-xs text-muted-foreground">{mineCount} maîtrisée{mineCount > 1 ? "s" : ""} sur {keywords.length}</span>}
      >
        <div className="grid gap-4 py-2">
          <p className="text-xs text-muted-foreground">
            Clique sur une compétence pour la marquer « maîtrisée » <Check className="inline size-3" />. Le score d&apos;une offre = compétences
            détectées que tu maîtrises / compétences détectées. Les variantes (alias) sont aussi cherchées dans les offres.
          </p>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrer…" className="h-8 w-full sm:w-64" />
          {categories.map((cat) => {
            const items = visible.filter((k) => (k.category ?? "Autres") === cat);
            if (!items.length) return null;
            return (
              <section key={cat}>
                <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">{cat}</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {items.map((k) => (
                    <KeywordChip key={k.id} keyword={k} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function KeywordChip({ keyword: k }: { keyword: Keyword }) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(k.label);
  const [aliases, setAliases] = useState(k.aliases.join(", "));

  if (editing) {
    return (
      <li className="flex w-full flex-wrap items-center gap-1.5 rounded-2xl bg-muted p-1.5 sm:w-auto">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-7 w-36" aria-label="Libellé" />
        <Input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Variantes" className="h-7 w-56" aria-label="Variantes" />
        <Button
          size="icon-xs"
          aria-label="Enregistrer"
          disabled={pending || !label.trim()}
          onClick={() => run(() => updateKeywordAction(k.id, { label, aliases: splitAliases(aliases) }), { onSuccess: () => setEditing(false) })}
        >
          <Check />
        </Button>
        <Button size="icon-xs" variant="ghost" aria-label="Annuler" onClick={() => setEditing(false)}>
          <X />
        </Button>
        <ConfirmButton
          title={`Supprimer « ${k.label} » de la liste ?`}
          description="Les scores des offres seront recalculés."
          confirmLabel="Supprimer"
          destructive
          onConfirm={() => run(() => deleteKeywordAction(k.id), { success: "Compétence supprimée" })}
        >
          <Button size="icon-xs" variant="ghost" aria-label="Supprimer">
            <Trash2 />
          </Button>
        </ConfirmButton>
      </li>
    );
  }

  return (
    <li className="group flex items-center">
      <button
        type="button"
        aria-pressed={k.mine}
        disabled={pending}
        title={k.aliases.length ? `Variantes : ${k.aliases.join(", ")}` : undefined}
        onClick={() => run(() => updateKeywordAction(k.id, { mine: !k.mine }))}
        className={cn(
          "flex items-center gap-1 rounded-l-md border py-0.5 pr-1.5 pl-2 text-[13px] transition-colors",
          k.mine
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
            : "border-dashed text-muted-foreground hover:text-foreground",
        )}
      >
        {k.mine && <Check className="size-3" />}
        {k.label}
        {k.aliases.length > 0 && <span className="text-[10px] opacity-60">+{k.aliases.length}</span>}
      </button>
      <button
        type="button"
        aria-label={`Modifier ${k.label}`}
        onClick={() => setEditing(true)}
        className={cn(
          "rounded-r-md border border-l-0 px-1 py-[5px] text-muted-foreground hover:text-foreground",
          k.mine ? "border-emerald-500/40" : "border-dashed",
        )}
      >
        <Pencil className="size-3" />
      </button>
    </li>
  );
}
