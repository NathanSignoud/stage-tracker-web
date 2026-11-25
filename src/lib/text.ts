/** Minuscules sans accents, pour les recherches et comparaisons « tolérantes ». */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Nettoie une saisie optionnelle : chaîne vide → null. */
export function emptyToNull(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** Majuscule à la première lettre seulement (« Mercredi 28 octobre », pas « Mercredi 28 Octobre »). */
export function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
