import { supabase } from "../supabase";
import { verifier } from "./client";

// Les modèles et les gabarits retirés du catalogue restent en base pour les livres qui les citent :
// seuls les actifs sont proposés.
export async function listerModeles() {
  const modeles = verifier(
    await requeteModeles(
      "id, nom, famille, nombre_doubles_pages_depart, theme(nom)",
    ),
  );
  return modeles ?? [];
}

// Pour la vitrine (E0) : le Visiteur lit les modèles, pas les thèmes (droits accordés à anon).
export async function listerModelesPublics() {
  const modeles = verifier(
    await requeteModeles("id, nom, famille, nombre_doubles_pages_depart"),
  );
  return modeles ?? [];
}

// Le filtre et l'ordre communs aux deux lectures du catalogue de modèles.
function requeteModeles<Colonnes extends string>(colonnes: Colonnes) {
  return supabase
    .from("modele_livre")
    .select(colonnes)
    .eq("actif", true)
    .order("nom");
}

export async function listerGabaritsInterieurs() {
  const gabarits = verifier(
    await supabase
      .from("gabarit")
      .select("id, nom, role, famille, actif")
      .eq("actif", true)
      .eq("role", "interieur"),
  );
  return gabarits ?? [];
}

export type ModeleDuCatalogue = Awaited<
  ReturnType<typeof listerModeles>
>[number];
