import { X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Saisie de tags : Entrée ou virgule pour valider, Retour arrière pour retirer le dernier. */
export function TagsInput({
  id,
  value,
  onChange,
  suggestions = [],
  className,
}: {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const listId = id ? `${id}-suggestions` : undefined;

  function add(raw: string) {
    const tag = raw.trim().replace(/,$/, "");
    if (tag && !value.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div
      className={cn(
        "flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        className,
      )}
    >
      {value.map((tag) => (
        <span key={tag} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
          {tag}
          <button type="button" aria-label={`Retirer ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        list={listId}
        value={draft}
        placeholder={value.length ? "" : "Ajouter un tag…"}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
        className="min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
      />
      {listId && (
        <datalist id={listId}>
          {suggestions.filter((s) => !value.includes(s)).map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
