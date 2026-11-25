import { supabase } from "@/lib/supabase";

// Accès aux tables : en base les colonnes sont en snake_case, dans le code en camelCase (comme la version locale).

export type Table =
  | "applications"
  | "status_changes"
  | "tags"
  | "application_tags"
  | "contacts"
  | "application_contacts"
  | "interactions"
  | "documents"
  | "application_documents"
  | "tasks"
  | "keywords"
  | "templates"
  | "interview_preps"
  | "prep_questions"
  | "companies"
  | "settings";

type Values = Record<string, unknown>;

/** Une écriture d'un plan (clés en camelCase). `match` : colonne = valeur, ou colonne parmi [valeurs]. */
export type PlanOp =
  | { table: Table; op: "insert"; values: Values }
  | { table: Table; op: "update"; values: Values; match: Values }
  | { table: Table; op: "delete"; match: Values };

/** Dans `values` : l'id créé par l'opération n du même plan (comptée à partir de 0). */
export const ref = (n: number) => ({ $ref: n });

const toSnake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (key: string) => key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
// Clés de premier niveau seulement : le contenu des colonnes JSON (réglages, alias) reste tel quel.
const mapKeys = (obj: Values, f: (key: string) => string) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [f(k), v]));

/** Ligne lue en base → objet du code. */
export const fromRow = <T>(row: Values): T => mapKeys(row, toCamel) as T;

/** Plan → paramètre de la fonction SQL apply_plan (supabase/migrations/20261125000000_schema.sql). */
export function toPlanPayload(ops: PlanOp[]) {
  return ops.map((o) => ({
    table: o.table,
    op: o.op,
    ...("values" in o && { values: mapKeys(o.values, toSnake) }),
    ...("match" in o && { match: mapKeys(o.match, toSnake) }),
  }));
}

/** Applique les écritures d'un bloc (tout ou rien). Renvoie l'id inséré par chaque opération (null sinon). */
export async function applyPlan(ops: PlanOp[]): Promise<(number | null)[]> {
  const { data, error } = await supabase.rpc("apply_plan", { ops: toPlanPayload(ops) });
  if (error) throw error;
  return data as (number | null)[];
}
