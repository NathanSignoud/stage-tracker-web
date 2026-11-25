// Essai local, jamais publié : le vrai site, mais sur un Postgres en mémoire (PGlite) dans le navigateur,
// connecté en tant que personne fictive. Sert aux tests d'interface (npm run dev → /tests/e2e/local.html#/candidatures).
import "@fontsource-variable/onest";
import "@fontsource-variable/unbounded";
import "@/index.css";
import { PGlite } from "@electric-sql/pglite";
import type { Session } from "@supabase/supabase-js";
import { ThemeProvider } from "next-themes";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { App } from "@/App";
import { AuthContext } from "@/auth";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UiProvider } from "@/components/ui-state";
import { setBackend } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { pgliteBackend, SUPABASE_STUB } from "../pglite-backend";

const migrations = import.meta.glob<string>("/supabase/migrations/*.sql", { query: "?raw", import: "default", eager: true });
const USER = "00000000-0000-4000-8000-0000000000e2";

const db = new PGlite();
await db.exec(SUPABASE_STUB);
for (const file of Object.keys(migrations).sort()) await db.exec(migrations[file]);
await db.query("insert into auth.users (id, email) values ($1, 'essai@stage-tracker.invalid')", [USER]);
await db.exec("set role authenticated");
await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: USER })]);
setBackend(pgliteBackend(db));
await ensureSeed();
Object.assign(window, { db }); // pour inspecter la base depuis les tests

const session = { user: { id: USER, email: "essai@stage-tracker.invalid" } } as Session;
const start = window.location.hash.slice(1) || "/";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
    <TooltipProvider delayDuration={300}>
      <AuthContext.Provider value={{ session, loading: false, isAdmin: true }}>
        <MemoryRouter initialEntries={[start]}>
          <UiProvider>
            <App />
          </UiProvider>
        </MemoryRouter>
      </AuthContext.Provider>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  </ThemeProvider>,
);
