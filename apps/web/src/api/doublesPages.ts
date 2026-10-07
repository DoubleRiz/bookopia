import {
  definitionGabaritSchema,
  type DoublePageComposee,
  type GabaritAComposer,
} from "@bookopia/shared";
import { supabase } from "../supabase";
import { ErreurBase, verifier } from "./client";

// Les doubles pages du livre, dans l'ordre du livre. L'énuméré role est déclaré dans cet ordre :
// trier par role puis position donne couverture, intérieures, 4e.
export async function listerDoublesPages(projetId: string) {
  const doublesPages = verifier(
    await supabase
      .from("double_page")
      .select(
        `id, role, position, gabarit_origine_id,
        emplacement (
          id, indice, nature, x, y, largeur, hauteur,
          photo_id, cadrage_x, cadrage_y, cadrage_zoom, contenu_texte
        )`,
      )
      .eq("projet_id", projetId)
      .order("role")
      .order("position")
      .order("indice", { referencedTable: "emplacement" }),
  );
  return doublesPages ?? [];
}

export type DoublePageDuLivre = Awaited<
  ReturnType<typeof listerDoublesPages>
>[number];

export type EmplacementDuLivre = DoublePageDuLivre["emplacement"][number];

// Les gabarits que le moteur peut choisir : intérieurs actifs de la famille du modèle d'origine.
// Un gabarit mal formé échoue ici, au parse, avant toute écriture.
// Liste vide si le livre n'existe plus ou n'a plus de modèle : composer_livre refusera,
// c'est la base qui tranche.
export async function listerGabaritsDuLivre(
  projetId: string,
): Promise<GabaritAComposer[]> {
  const projet = verifier(
    await supabase
      .from("projet")
      .select("modele_livre (famille)")
      .eq("id", projetId)
      .maybeSingle(),
  );
  const famille = projet?.modele_livre?.famille;
  if (!famille) {
    return [];
  }
  const gabarits = verifier(
    await supabase
      .from("gabarit")
      .select("id, nom, definition")
      .eq("actif", true)
      .eq("role", "interieur")
      .eq("famille", famille),
  );
  return (gabarits ?? []).map((gabarit) => ({
    id: gabarit.id,
    nom: gabarit.nom,
    definition: definitionGabaritSchema.parse(gabarit.definition),
  }));
}

// Remplace les intérieures du livre par la composition du moteur. Renvoie leur nombre.
export async function enregistrerComposition(
  projetId: string,
  doublesPages: DoublePageComposee[],
): Promise<number> {
  const creees = verifier(
    await supabase.rpc("composer_livre", {
      p_projet_id: projetId,
      p_doubles_pages: doublesPages,
    }),
  );
  return creees ?? 0;
}

// Écrit la photo et le cadrage d'un emplacement tels que l'éditeur les affiche.
// La RLS et les contraintes de la table sont les seules gardiennes : photo d'un autre livre,
// cadre texte, cadrage hors bornes. Aucune ligne modifiée : l'emplacement n'existe plus.
export async function ecrireEmplacement(
  emplacement: EmplacementDuLivre,
): Promise<void> {
  const modifie = verifier(
    await supabase
      .from("emplacement")
      .update({
        photo_id: emplacement.photo_id,
        cadrage_x: emplacement.cadrage_x,
        cadrage_y: emplacement.cadrage_y,
        cadrage_zoom: emplacement.cadrage_zoom,
      })
      .eq("id", emplacement.id)
      .select("id")
      .maybeSingle(),
  );
  if (!modifie) {
    throw new ErreurBase("introuvable", "Emplacement disparu");
  }
}

// Les fonctions de structure tiennent les rangs 1..N sous le verrou du projet.
// Celles qui créent une double page renvoient son identifiant ; jamais null quand elles réussissent.
function identifiantCree(id: string | null): string {
  if (!id) {
    throw new ErreurBase("introuvable", "Aucune double page créée");
  }
  return id;
}

export async function insererDoublePage(
  projetId: string,
  gabaritId: string,
  position: number,
): Promise<string> {
  return identifiantCree(
    verifier(
      await supabase.rpc("inserer_double_page", {
        p_projet_id: projetId,
        p_gabarit_id: gabaritId,
        p_position: position,
      }),
    ),
  );
}

export async function deplacerDoublePage(
  doublePageId: string,
  position: number,
): Promise<void> {
  verifier(
    await supabase.rpc("deplacer_double_page", {
      p_double_page_id: doublePageId,
      p_position: position,
    }),
  );
}

export async function dupliquerDoublePage(
  doublePageId: string,
): Promise<string> {
  return identifiantCree(
    verifier(
      await supabase.rpc("dupliquer_double_page", {
        p_double_page_id: doublePageId,
      }),
    ),
  );
}

export async function supprimerDoublePage(doublePageId: string): Promise<void> {
  verifier(
    await supabase.rpc("supprimer_double_page", {
      p_double_page_id: doublePageId,
    }),
  );
}

// Les cadres sont recréés vides : l'éditeur a prévenu avant d'appeler.
export async function changerGabarit(
  doublePageId: string,
  gabaritId: string,
): Promise<void> {
  verifier(
    await supabase.rpc("changer_gabarit", {
      p_double_page_id: doublePageId,
      p_gabarit_id: gabaritId,
    }),
  );
}
