import { TILE_TONES, type TileTone } from "@/components/dashboard/tile";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Bloc de contenu (titre + compteur + corps). */
export function Panel({
  title,
  count,
  actions,
  children,
  className,
  empty,
  tone = "plain",
}: {
  title: React.ReactNode;
  count?: number;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Message affiché quand `count === 0`. */
  empty?: string;
  /** Teinte du sujet (entretiens, tâches…), comme sur le tableau de bord. */
  tone?: TileTone;
}) {
  return (
    // min-w-0 : sinon les textes tronqués (nowrap) élargissent la colonne de grille parente.
    <section className={cn("min-w-0 rounded-3xl", TILE_TONES[tone], className)}>
      <header className="flex min-h-12 items-center gap-2 px-5 pt-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {count !== undefined && (
          <span className={cn("rounded-full px-2 text-xs font-semibold tabular-nums", tone === "plain" ? "bg-muted text-muted-foreground" : "bg-background/60")}>{count}</span>
        )}
        <div className="ml-auto flex items-center gap-1">{actions}</div>
      </header>
      <div className="px-5 pt-1 pb-4">
        {count === 0 && empty ? <p className="py-2 text-sm text-muted-foreground">{empty}</p> : children}
      </div>
    </section>
  );
}
