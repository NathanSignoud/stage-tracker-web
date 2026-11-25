import { Mail } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import logoDark from "@/assets/logo-dark.svg";
import logo from "@/assets/logo.svg";
import { useAuth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

/** Erreur renvoyée par Supabase dans l'adresse au retour de Google ou du lien email (ex. adresse non invitée, lien expiré). */
function redirectError(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
  if (params.get("error_code") === "otp_expired") return "Ce lien a expiré ou a déjà servi. Demande un nouveau lien ci-dessous.";
  const description = params.get("error_description");
  return description ? description.replace(/\+/g, " ") : null;
}

// Lue au chargement du site : la redirection vers /connexion efface l'adresse avant que cette page s'affiche.
const startupError = redirectError();

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
    </svg>
  );
}

export function LoginPage() {
  const { session } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(startupError);
  const [pending, setPending] = useState(false);

  if (session) return <Navigate to={from} replace />;

  async function google() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + from },
    });
    if (error) setError(error.message);
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const address = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: window.location.origin + from },
    });
    setPending(false);
    if (error) setError(error.message);
    else setSentTo(address);
  }

  return (
    <div className="grid min-h-svh place-items-center bg-background px-4 py-10">
      <main className="w-full max-w-sm">
        <div className="flex justify-center">
          <img src={logo} alt="Stage Tracker" width={177} height={32} className="h-8 w-auto dark:hidden" />
          <img src={logoDark} alt="Stage Tracker" width={177} height={32} className="hidden h-8 w-auto dark:block" />
        </div>
        <div className="mt-6 rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Connexion</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Stage Tracker est sur invitation : connecte-toi avec l&apos;adresse qui a été invitée.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Première visite ou non, c&apos;est le même bouton : ton compte est créé tout seul la première fois.
          </p>

          {error && (
            <p role="alert" className="mt-4 rounded-2xl bg-tile-stale px-4 py-3 text-sm text-tile-stale-ink">
              {error}
            </p>
          )}

          {sentTo ? (
            <div className="mt-6 rounded-2xl bg-tile-send px-4 py-4 text-sm">
              <p className="font-semibold">Lien envoyé à {sentTo}</p>
              <p className="mt-1 text-tile-send-ink">Ouvre l&apos;email sur cet appareil et clique sur le lien. Pense à regarder dans les spams.</p>
              <button type="button" className="mt-3 text-sm font-medium underline" onClick={() => setSentTo(null)}>
                Utiliser une autre adresse
              </button>
            </div>
          ) : (
            <>
              <Button size="lg" variant="outline" className="mt-6 w-full" onClick={google}>
                <GoogleIcon /> Continuer avec Google
              </Button>

              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
                <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={sendLink} className="grid gap-2">
                <Label htmlFor="email">Adresse email</Label>
                <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
                  <Mail /> {pending ? "Envoi…" : "Recevoir un lien de connexion"}
                </Button>
              </form>
            </>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/confidentialite" className="underline">
            Règles de confidentialité
          </Link>
        </p>
      </main>
    </div>
  );
}
