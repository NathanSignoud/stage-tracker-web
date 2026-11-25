import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  // Page d'essai locale (tests/e2e/local.html) : PGlite charge son propre WebAssembly.
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
});
