import { supabase } from "../supabase";
import { verifier } from "./client";

// Les modèles et les gabarits retirés du catalogue restent en base pour les livres qui les citent :
// seuls les actifs sont proposés.
export async function listerModeles() {
  const modeles = verifier(
    await supabase
      .from("modele_livre")
      .select("id, nom, famille, nombre_doubles_pages_depart, theme(nom)")
      .eq("actif", true)
      .order("nom"),
  );
  return modeles ?? [];
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
