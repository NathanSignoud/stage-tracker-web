import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { toast } from "sonner";
import { ensureSeed } from "@/lib/seed";
import { supabase } from "@/lib/supabase";

type AuthState = { session: Session | null; loading: boolean; isAdmin: boolean };

export const AuthContext = createContext<AuthState>({ session: null, loading: true, isAdmin: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.rpc("is_admin").then(({ data }) => {
      if (!cancelled) setIsAdmin(data === true);
    });
    ensureSeed().catch((e: Error) => toast.error(`Impossible de préparer ton compte : ${e.message}`));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return <AuthContext.Provider value={{ session, loading, isAdmin: Boolean(userId) && isAdmin }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** Pages réservées aux personnes connectées : sinon, redirection vers /connexion (puis retour à la page demandée). */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">Chargement…</div>;
  if (!session) return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
