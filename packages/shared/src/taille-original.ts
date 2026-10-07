import type { Cadre } from "./gabarit";

const DPI_IMPRESSION = 300;
const MM_PAR_POUCE = 25.4;
// Un cadre au bord de la double page déborde dans le fond perdu : on le compte partout,
// plutôt que de savoir quel côté touche le bord.
const FOND_PERDU_MM = 3;

// Pixels qu'exige un côté de cadre pour être imprimé à 300 DPI, fond perdu compris.
export function pixelsPour300Dpi(coteMm: number): number {
  return Math.ceil(
    ((coteMm + 2 * FOND_PERDU_MM) / MM_PAR_POUCE) * DPI_IMPRESSION,
  );
}

// Taille de l'original déposé : la plus petite qui couvre encore chacun des cadres photo à 300 DPI.
// Une photo couvre son cadre : c'est le côté le plus exigeant qui fixe la réduction.
// Jamais d'agrandissement : il n'ajoute aucun détail.
export function tailleOriginal(
  largeurPx: number,
  hauteurPx: number,
  cadresPhoto: Pick<Cadre, "largeur" | "hauteur">[],
): { largeur: number; hauteur: number } {
  const facteur = Math.min(
    1,
    Math.max(
      0,
      ...cadresPhoto.map((cadre) =>
        Math.max(
          pixelsPour300Dpi(cadre.largeur) / largeurPx,
          pixelsPour300Dpi(cadre.hauteur) / hauteurPx,
        ),
      ),
    ),
  );
  if (facteur === 0) {
    return { largeur: largeurPx, hauteur: hauteurPx };
  }
  return {
    largeur: Math.round(largeurPx * facteur),
    hauteur: Math.round(hauteurPx * facteur),
  };
}
