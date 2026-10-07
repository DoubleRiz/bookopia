import type { EntreeCreerProjet, EntreeRenommerProjet } from "@bookopia/shared";
import { supabase } from "../supabase";
import { ErreurBase, verifier } from "./client";

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

// Couverture, intérieures et 4e sont créées d'un coup par la base : un projet incomplet n'existe pas.
export async function creerProjet(entree: EntreeCreerProjet): Promise<string> {
  const projetId = verifier(
    await supabase.rpc("creer_projet", {
      p_titre: entree.titre,
      p_modele_livre_id: entree.modeleLivreId,
      p_gabarits_interieurs_ids: entree.gabaritsInterieursIds,
    }),
  );
  if (!projetId) {
    throw new ErreurBase(
      "contrat",
      "creer_projet n'a pas renvoyé d'identifiant",
    );
  }
  return projetId;
}

// La RLS filtre sans erreur : aucune ligne touchée veut dire que le livre n'est pas (ou plus) à lui.
function auMoinsUneLigne<T>(lignes: T[] | null): T {
  const [ligne] = lignes ?? [];
  if (ligne === undefined) {
    throw new ErreurBase("introuvable", "Livre introuvable");
  }
  return ligne;
}

export async function renommerProjet(
  projetId: string,
  entree: EntreeRenommerProjet,
) {
  auMoinsUneLigne(
    verifier(
      await supabase
        .from("projet")
        .update({ titre: entree.titre })
        .eq("id", projetId)
        .select("id"),
    ),
  );
}

// La ligne d'abord, les fichiers ensuite : une interruption laisse au pire des fichiers inutiles,
// jamais une ligne qui désigne un fichier absent. La cascade emporte doubles pages, photos et export.
export async function supprimerProjet(projetId: string) {
  const { utilisateur_id } = auMoinsUneLigne(
    verifier(
      await supabase
        .from("projet")
        .delete()
        .eq("id", projetId)
        .select("utilisateur_id"),
    ),
  );
  const racine = `${utilisateur_id}/${projetId}`;
  await Promise.all([
    viderDossier("photos", `${racine}/originaux`),
    viderDossier("photos", `${racine}/vignettes`),
    viderDossier("exports", racine),
  ]);
}

const TAILLE_LOT_STOCKAGE = 1000;

// Le livre est déjà supprimé : un échec ici ne doit pas faire croire le contraire au Créateur.
// Il laisse des fichiers inutiles, que la règle Storage rend inaccessibles à tout autre compte.
async function viderDossier(bucket: "photos" | "exports", dossier: string) {
  const stockage = supabase.storage.from(bucket);
  // Pas de décalage : chaque lot supprimé, la liste suivante repart du début.
  for (;;) {
    const { data: fichiers, error } = await stockage.list(dossier, {
      limit: TAILLE_LOT_STOCKAGE,
    });
    if (error || !fichiers || fichiers.length === 0) {
      return;
    }
    const { error: erreurSuppression } = await stockage.remove(
      fichiers.map((fichier) => `${dossier}/${fichier.name}`),
    );
    if (erreurSuppression || fichiers.length < TAILLE_LOT_STOCKAGE) {
      return;
    }
  }
}
