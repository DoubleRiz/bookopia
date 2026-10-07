import {
  definitionGabaritSchema,
  type DoublePageComposee,
  type GabaritAComposer,
} from "@bookopia/shared";
import { supabase } from "../supabase";
import { verifier } from "./client";

// Les doubles pages du livre, dans l'ordre du livre. L'énuméré role est déclaré dans cet ordre :
// trier par role puis position donne couverture, intérieures, 4e.
export async function listerDoublesPages(projetId: string) {
  const doublesPages = verifier(
    await supabase
      .from("double_page")
      .select(
        `id, role, position,
        emplacement (
          id, indice, nature, x, y, largeur, hauteur,
          photo_id, cadrage_x, cadrage_y, cadrage_zoom
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
