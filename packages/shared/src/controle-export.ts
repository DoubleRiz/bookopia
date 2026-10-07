import { dpiEffectif, niveauResolution } from "./cadrage";

export type EmplacementAControler = {
  id: string;
  nature: "photo" | "texte";
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  cadrage_x: number | null;
  cadrage_y: number | null;
  cadrage_zoom: number | null;
  photo: { largeur_px: number; hauteur_px: number } | null;
};

export type DoublePageAControler = {
  id: string;
  emplacements: EmplacementAControler[];
};

export type ControleExport = {
  faibles: { double_page_id: string; emplacement_id: string; dpi: number }[];
  vides: { double_page_id: string; emplacement_id: string }[];
};

// Ce que le Créateur doit savoir avant de lancer le rendu : les cadres photo sous 150 DPI
// et ceux restés vides (RG-20). Rien de tout cela ne bloque l'export (RG-16).
// Les cadres texte ne comptent pas : un texte absent est un choix valable.
// Les listes suivent l'ordre reçu, c'est-à-dire celui du livre.
export function controlerExport(
  doublesPages: DoublePageAControler[],
): ControleExport {
  const resultat: ControleExport = { faibles: [], vides: [] };
  for (const doublePage of doublesPages) {
    for (const emplacement of doublePage.emplacements) {
      if (emplacement.nature !== "photo") continue;
      const { photo } = emplacement;
      if (!photo) {
        resultat.vides.push({
          double_page_id: doublePage.id,
          emplacement_id: emplacement.id,
        });
        continue;
      }
      // Une photo posée a toujours un cadrage (contrainte de la base) : le neutre n'est qu'un filet.
      const dpi = dpiEffectif(
        {
          x: emplacement.x,
          y: emplacement.y,
          largeur: emplacement.largeur,
          hauteur: emplacement.hauteur,
          cadrage_x: emplacement.cadrage_x ?? 0.5,
          cadrage_y: emplacement.cadrage_y ?? 0.5,
          cadrage_zoom: emplacement.cadrage_zoom ?? 1,
        },
        photo,
      );
      if (niveauResolution(dpi) === "faible") {
        resultat.faibles.push({
          double_page_id: doublePage.id,
          emplacement_id: emplacement.id,
          dpi,
        });
      }
    }
  }
  return resultat;
}
