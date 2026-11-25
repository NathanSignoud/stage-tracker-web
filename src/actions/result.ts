import { z } from "zod";
import { revalidate } from "@/lib/data";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/** Exécute une modification puis recharge les données affichées. Les erreurs deviennent un message affichable. */
export async function mutate<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidate();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Saisie invalide";
  // Les erreurs de Supabase sont des objets { message } (pas toujours des Error).
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Erreur inattendue";
}
