import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY manquent (fichier .env).");

/** Client unique. La clé est publique : chaque requête ne voit que ce que les règles (RLS) autorisent. */
export const supabase = createClient(url, key);
