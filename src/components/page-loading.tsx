import { errorMessage } from "@/actions/result";

/** En attendant les données d'une page (ou si elles n'ont pas pu être chargées). */
export function PageLoading({ error }: { error?: unknown }) {
  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <p role="alert" className="rounded-3xl bg-tile-stale p-5 text-sm text-tile-stale-ink">
          Impossible de charger la page : {errorMessage(error)}
        </p>
      </div>
    );
  }
  return <div className="grid place-items-center py-20 text-sm text-muted-foreground">Chargement…</div>;
}
