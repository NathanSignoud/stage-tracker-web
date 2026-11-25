import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { setBackend } from "@/lib/db";
import { pgliteBackend, SUPABASE_STUB } from "./pglite-backend";
import type { ApplicationInput } from "@/lib/validation";

export const root = path.resolve(import.meta.dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

/** Postgres en mémoire avec toutes les migrations du projet. */
export async function migratedDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  return db;
}

let shared: Promise<PGlite> | undefined;

/**
 * Connecte une nouvelle personne fictive : les services lisent et écrivent alors dans PGlite en son nom.
 * Une base par fichier de test ; chaque test a sa propre personne, donc des données vides (isolées par RLS).
 */
export async function testUser(): Promise<string> {
  shared ??= migratedDb().then((db) => {
    setBackend(pgliteBackend(db));
    return db;
  });
  const db = await shared;
  const id = randomUUID();
  await db.exec("reset role");
  await db.query("insert into auth.users (id) values ($1)", [id]);
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: id })]);
  return id;
}

/** Date locale fixe (midi, pour éviter tout effet de fuseau). */
export function at(day: string, time = "12:00"): Date {
  return new Date(`${day}T${time}:00`);
}

export function appInput(overrides: Partial<ApplicationInput> = {}): ApplicationInput {
  return {
    company: "Acme AI",
    title: "Stage ML",
    offerUrl: null,
    offerText: null,
    source: null,
    location: null,
    remote: null,
    duration: null,
    startDate: null,
    stipend: null,
    deadline: null,
    sentDate: null,
    priority: 2,
    notes: null,
    ...overrides,
  };
}
