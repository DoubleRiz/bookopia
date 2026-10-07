import { supabase } from "../supabase";
import { verifier } from "./client";

// La RLS ne renvoie que les livres du Créateur connecté : aucun filtre à écrire ici.
export async function listerProjets() {
  const projets = verifier(
    await supabase
      .from("projet")
      .select("id, titre, brouillon, modifie_le")
      .order("modifie_le", { ascending: false }),
  );
  return projets ?? [];
}

export type ResumeProjet = Awaited<ReturnType<typeof listerProjets>>[number];
