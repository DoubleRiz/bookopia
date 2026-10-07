// Calculs du recadrage, partagés par l'écran et le PDF : les deux doivent montrer la même zone.

// Format fini d'une double page, en millimètres. Origine en haut à gauche, comme les gabarits.
export const LARGEUR_DOUBLE_PAGE_MM = 420;
export const HAUTEUR_DOUBLE_PAGE_MM = 210;
export const FOND_PERDU_MM = 3;

export type Rectangle = {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
};

// Un bord de cadre qui touche le bord de la double page déborde de 3 mm : à la coupe,
// la lame peut dévier, et il ne doit pas rester de filet blanc. Les autres bords ne bougent pas.
export function prolongerParFondPerdu(cadre: Rectangle): Rectangle {
  const gauche = cadre.x <= 0 ? -FOND_PERDU_MM : cadre.x;
  const haut = cadre.y <= 0 ? -FOND_PERDU_MM : cadre.y;
  const droite =
    cadre.x + cadre.largeur >= LARGEUR_DOUBLE_PAGE_MM
      ? LARGEUR_DOUBLE_PAGE_MM + FOND_PERDU_MM
      : cadre.x + cadre.largeur;
  const bas =
    cadre.y + cadre.hauteur >= HAUTEUR_DOUBLE_PAGE_MM
      ? HAUTEUR_DOUBLE_PAGE_MM + FOND_PERDU_MM
      : cadre.y + cadre.hauteur;
  return { x: gauche, y: haut, largeur: droite - gauche, hauteur: bas - haut };
}

// Zone de l'image, en pixels depuis son coin haut gauche, qui remplit le cadre.
// Zoom 1 : la plus grande zone aux proportions du cadre. Le zoom la rétrécit autour du centre
// demandé (cadrage_x, cadrage_y entre 0 et 1), ramené pour que la zone ne sorte jamais de l'image.
export function zoneVisible(
  image: { largeur_px: number; hauteur_px: number },
  cadre: { largeur: number; hauteur: number },
  cadrage: { x: number; y: number; zoom: number },
): Rectangle {
  const proportion = cadre.largeur / cadre.hauteur;
  const imagePlusLarge = image.largeur_px / image.hauteur_px > proportion;
  const largeurBase = imagePlusLarge
    ? image.hauteur_px * proportion
    : image.largeur_px;
  const hauteurBase = imagePlusLarge
    ? image.hauteur_px
    : image.largeur_px / proportion;
  const largeur = largeurBase / cadrage.zoom;
  const hauteur = hauteurBase / cadrage.zoom;
  const centreX = borner(
    cadrage.x * image.largeur_px,
    largeur / 2,
    image.largeur_px - largeur / 2,
  );
  const centreY = borner(
    cadrage.y * image.hauteur_px,
    hauteur / 2,
    image.hauteur_px - hauteur / 2,
  );
  return {
    x: centreX - largeur / 2,
    y: centreY - hauteur / 2,
    largeur,
    hauteur,
  };
}

// Où dessiner une photo posée : le cadre de l'emplacement prolongé du fond perdu, en millimètres,
// et la zone de l'image, en pixels de l'original, qui le remplit. Le PDF et l'écran l'appellent tous les deux.
export function placerPhoto(
  emplacement: Rectangle & {
    cadrage_x: number;
    cadrage_y: number;
    cadrage_zoom: number;
  },
  photo: { largeur_px: number; hauteur_px: number },
): { cadre: Rectangle; zone: Rectangle } {
  const cadre = prolongerParFondPerdu(emplacement);
  const zone = zoneVisible(photo, cadre, {
    x: emplacement.cadrage_x,
    y: emplacement.cadrage_y,
    zoom: emplacement.cadrage_zoom,
  });
  return { cadre, zone };
}

function borner(valeur: number, min: number, max: number): number {
  return Math.min(Math.max(valeur, min), max);
}
