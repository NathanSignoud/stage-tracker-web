import { cn } from "@/lib/utils";

/** Teinte de fond par sujet (design Atelier) : la même couleur désigne le même sujet dans toute l'app. */
export const TILE_TONES = {
  interview: "bg-tile-interview",
  task: "bg-tile-task",
  send: "bg-tile-send",
  stale: "bg-tile-stale",
  stat: "bg-tile-stat",
  plain: "bg-card ring-1 ring-border",
} as const;

export type TileTone = keyof typeof TILE_TONES;

/** Bloc du tableau de bord : titre (+ compteur, + lien à droite) et contenu, sur la teinte de son sujet. */
export function Tile({
  tone = "plain",
  title,
  count,
  action,
  className,
  children,
}: {
  tone?: TileTone;
  title: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-4 rounded-3xl p-5 sm:p-6", TILE_TONES[tone], className)}>
      <header className="flex min-h-7 items-center gap-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {count !== undefined && (
          <span className="rounded-full bg-background/60 px-2 text-xs font-semibold tabular-nums">{count}</span>
        )}
        {action && <div className="ml-auto text-[13px] font-medium">{action}</div>}
      </header>
      {children}
    </section>
  );
}
