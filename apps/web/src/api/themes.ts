import { type Theme, themeSchema } from "@bookopia/shared";
import { supabase } from "../supabase";
import { verifier } from "./client";

export type ThemeDuCatalogue = Theme & { id: string; nom: string };

// Un thème lu en base : son JSON n'y est pas validé. Mal formé, il échoue ici,
// avant qu'un écran ou un PDF ne le dessine avec une police de substitution.
export function lireTheme(brut: {
  id: string;
  nom: string;
  palette: unknown;
  bordure_cadre: unknown;
  typographie: unknown;
}): ThemeDuCatalogue {
  return { id: brut.id, nom: brut.nom, ...themeSchema.parse(brut) };
}

// Les thèmes proposés, dans l'ordre du catalogue.
export async function listerThemes(): Promise<ThemeDuCatalogue[]> {
  const themes = verifier(
    await supabase
      .from("theme")
      .select("id, nom, palette, bordure_cadre, typographie")
      .eq("actif", true)
      .order("id"),
  );
  return (themes ?? []).map(lireTheme);
}

// changer_theme vérifie le livre et le thème : un thème retiré entre-temps est « invalide ».
export async function changerTheme(
  projetId: string,
  themeId: string,
): Promise<void> {
  verifier(
    await supabase.rpc("changer_theme", {
      p_projet_id: projetId,
      p_theme_id: themeId,
    }),
  );
}
