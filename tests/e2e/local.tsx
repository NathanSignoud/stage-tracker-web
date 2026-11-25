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
import { clearReadCache, setBackend } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import { setFileStore } from "@/lib/storage";
import { pgliteBackend, SUPABASE_STUB } from "../pglite-backend";

const migrations = import.meta.glob<string>("/supabase/migrations/*.sql", { query: "?raw", import: "default", eager: true });
const USER = "00000000-0000-4000-8000-0000000000e2";

const db = new PGlite();
await db.exec(SUPABASE_STUB);
for (const file of Object.keys(migrations).sort()) await db.exec(migrations[file]);
await db.query("insert into auth.users (id, email) values ($1, 'essai@stage-tracker.invalid')", [USER]);
await db.exec("set role authenticated");
await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: USER })]);
// Compteur des lectures (nombre de requêtes et volume JSON), pour mesurer ce que chaque page coûterait chez Supabase.
const stats = { selects: 0, bytes: 0, byTable: {} as Record<string, number>, kbByTable: {} as Record<string, number> };
const backend = pgliteBackend(db);
setBackend({
  ...backend,
  async select(table, where, columns) {
    const rows = await backend.select(table, where, columns);
    stats.selects++;
    const size = JSON.stringify(rows).length;
    stats.bytes += size;
    stats.byTable[table] = (stats.byTable[table] ?? 0) + 1;
    stats.kbByTable[table] = Math.round(((stats.kbByTable[table] ?? 0) * 1024 + size) / 1024);
    return rows;
  },
});
// Fichiers des documents gardés en mémoire (à la place de Supabase Storage).
const stored = new Map<string, Blob>();
setFileStore({
  upload: async (file, fileName) => {
    const path = `${USER}/${crypto.randomUUID()}-${fileName}`;
    stored.set(path, file);
    return path;
  },
  download: async (path) => stored.get(path) ?? Promise.reject(new Error("Fichier introuvable")),
  remove: async (paths) => paths.forEach((p) => stored.delete(p)),
});
await ensureSeed();
// Pour les tests : la base (chaque écriture directe vide le cache de lectures, comme le ferait le site), les fichiers, le compteur.
const testDb = {
  query: async (...args: Parameters<typeof db.query>) => {
    const result = await db.query(...args);
    clearReadCache();
    return result;
  },
};
Object.assign(window, { db: testDb, stored, stats });

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
