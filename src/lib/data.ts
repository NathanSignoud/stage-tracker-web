import { useEffect, useState } from "react";

// Après chaque modification, toutes les données affichées sont rechargées (l'équivalent de
// revalidatePath("/", "layout") dans la version locale : l'app est petite, pas de rechargement fin).
const listeners = new Set<() => void>();

export function revalidate(): void {
  for (const listener of listeners) listener();
}

/** Charge des données pour une page ; recharge quand `deps` change et après chaque modification. */
export function useData<T>(load: () => Promise<T>, deps: readonly unknown[] = []): { data?: T; error?: Error } {
  const key = JSON.stringify(deps);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key?: string; data?: T; error?: Error }>({});

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => !cancelled && setState({ key, data }),
      (error: Error) => !cancelled && setState({ key, error }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` résume deps ; `version` déclenche le rechargement.
  }, [key, version]);

  // Données d'un autre jeu de paramètres (ex. une autre fiche) : on ne les montre pas.
  return state.key === key ? { data: state.data, error: state.error } : {};
}
