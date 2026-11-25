import { cn } from "@/lib/utils";

// Teintes assez foncées pour un texte blanc lisible (contraste ≥ 4,5:1).
const COLORS = ["#c2255c", "#1864ab", "#5f3dc4", "#2b8a3e", "#c2410c", "#0b7285", "#a61e4d", "#087f5b"];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function companyInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2);
  return initials.toUpperCase();
}

/** Pastille d'entreprise (initiales sur une couleur stable dérivée du nom), en guise de logo. */
export function CompanyMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-white", className)}
      style={{ background: COLORS[hash(name.toLowerCase()) % COLORS.length] }}
    >
      {companyInitials(name)}
    </span>
  );
}
