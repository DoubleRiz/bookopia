import { createClient } from "@supabase/supabase-js";
import type { Database } from "@bookopia/shared";

const url = import.meta.env.VITE_SUPABASE_URL;
const clePublique = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !clePublique) {
  throw new Error(
    "VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY doivent être définies dans .env",
  );
}

// Seule la clé publique (anon) vit dans le front : ce que le Créateur peut lire ou écrire,
// ce sont la RLS et les droits de la base qui le décident.
export const supabase = createClient<Database>(url, clePublique);
