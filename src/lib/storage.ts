import { supabase } from "@/lib/supabase";

// Fichiers des documents : espace privé « documents » de Supabase Storage, un dossier par personne
// (règle d'accès : supabase/migrations/20261126000000_fichiers_agenda.sql). Remplaçable dans les tests.

export type FileStore = {
  /** Range le fichier dans le dossier de la personne connectée ; renvoie son chemin. */
  upload(file: Blob, fileName: string, contentType: string): Promise<string>;
  download(path: string): Promise<Blob>;
  remove(paths: string[]): Promise<void>;
};

const BUCKET = "documents";

/** Nom sans accents ni caractères spéciaux (les chemins Storage n'aiment pas les espaces et accents). */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop()!.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return base.replace(/[^\w.-]+/g, "_").slice(-120) || "document";
}

const supabaseStore: FileStore = {
  async upload(file, fileName, contentType) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Connecte-toi pour envoyer un fichier");
    const path = `${data.session.user.id}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType, upsert: false });
    if (error) throw error;
    return path;
  },
  async download(path) {
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error) throw error;
    return data;
  },
  async remove(paths) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) throw error;
  },
};

export let files: FileStore = supabaseStore;
/** Tests uniquement : fichiers gardés ailleurs (en mémoire). */
export const setFileStore = (store: FileStore) => {
  files = store;
};
