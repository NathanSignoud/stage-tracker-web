import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="font-heading text-2xl font-bold tracking-tight">Page introuvable</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Cette adresse n&apos;existe pas.{" "}
        <Link to="/" className="font-medium text-foreground underline">
          Retour à l&apos;accueil
        </Link>
      </p>
    </div>
  );
}
