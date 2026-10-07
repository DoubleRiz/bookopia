import {
  clip,
  endPath,
  PDFDocument,
  type PDFImage,
  type PDFPage,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
} from "pdf-lib";
import {
  FOND_PERDU_MM,
  HAUTEUR_DOUBLE_PAGE_MM,
  LARGEUR_DOUBLE_PAGE_MM,
  prolongerParFondPerdu,
  type Rectangle,
  zoneVisible,
} from "./cadrage";

export type PhotoARendre = {
  // L'original JPEG tel que déposé dans Storage : intégré sans réencodage.
  octets: Uint8Array;
  largeur_px: number;
  hauteur_px: number;
};

export type EmplacementARendre = Rectangle & {
  nature: "photo" | "texte";
  photo: PhotoARendre | null;
  cadrage_x: number;
  cadrage_y: number;
  cadrage_zoom: number;
};

// Tout ce que le rendu doit savoir, déjà lu et téléchargé : aucun accès réseau ni base ici.
export type LivreARendre = {
  // Couleur de fond du thème, « #RRGGBB ».
  fond: string;
  // Dans l'ordre du livre : couverture, intérieures, 4e.
  doubles_pages: { emplacements: EmplacementARendre[] }[];
};

const POINTS_PAR_MM = 72 / 25.4;
const LONGUEUR_TRAIT_MM = 5;
// Les traits de coupe vivent hors du fond perdu, sinon ils seraient imprimés sur la page.
const MARGE_TRAITS_MM = LONGUEUR_TRAIT_MM;
const DECALAGE_COUPE_MM = MARGE_TRAITS_MM + FOND_PERDU_MM;
const LARGEUR_PAGE_MM = LARGEUR_DOUBLE_PAGE_MM + 2 * DECALAGE_COUPE_MM;
const HAUTEUR_PAGE_MM = HAUTEUR_DOUBLE_PAGE_MM + 2 * DECALAGE_COUPE_MM;
const GRIS_EMPLACEMENT_VIDE = rgb(0.85, 0.85, 0.85);
const NOIR = rgb(0, 0, 0);

const pt = (mm: number) => mm * POINTS_PAR_MM;

// Les gabarits ont leur origine en haut à gauche de la coupe, le PDF en bas à gauche de la page.
function versPdf(zone: Rectangle) {
  return {
    x: pt(DECALAGE_COUPE_MM + zone.x),
    y: pt(DECALAGE_COUPE_MM + HAUTEUR_DOUBLE_PAGE_MM - zone.y - zone.hauteur),
    width: pt(zone.largeur),
    height: pt(zone.hauteur),
  };
}

function couleur(hexadecimal: string) {
  const valeur = Number.parseInt(hexadecimal.slice(1), 16);
  return rgb(
    ((valeur >> 16) & 0xff) / 255,
    ((valeur >> 8) & 0xff) / 255,
    (valeur & 0xff) / 255,
  );
}

// Les trois boîtes que lit l'imprimeur : la page entière, la zone imprimée, le format fini.
function poserBoites(page: PDFPage) {
  page.setMediaBox(0, 0, pt(LARGEUR_PAGE_MM), pt(HAUTEUR_PAGE_MM));
  page.setBleedBox(
    pt(MARGE_TRAITS_MM),
    pt(MARGE_TRAITS_MM),
    pt(LARGEUR_DOUBLE_PAGE_MM + 2 * FOND_PERDU_MM),
    pt(HAUTEUR_DOUBLE_PAGE_MM + 2 * FOND_PERDU_MM),
  );
  page.setTrimBox(
    pt(DECALAGE_COUPE_MM),
    pt(DECALAGE_COUPE_MM),
    pt(LARGEUR_DOUBLE_PAGE_MM),
    pt(HAUTEUR_DOUBLE_PAGE_MM),
  );
}

// Huit traits dans la marge, dans le prolongement des bords de coupe : deux par coin.
function tracerTraitsDeCoupe(page: PDFPage) {
  const gauche = pt(DECALAGE_COUPE_MM);
  const droite = pt(DECALAGE_COUPE_MM + LARGEUR_DOUBLE_PAGE_MM);
  const bas = pt(DECALAGE_COUPE_MM);
  const haut = pt(DECALAGE_COUPE_MM + HAUTEUR_DOUBLE_PAGE_MM);
  const largeurPage = pt(LARGEUR_PAGE_MM);
  const hauteurPage = pt(HAUTEUR_PAGE_MM);
  const longueur = pt(LONGUEUR_TRAIT_MM);
  const trait = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.25,
      color: NOIR,
    });

  for (const y of [bas, haut]) {
    trait(0, y, longueur, y);
    trait(largeurPage - longueur, y, largeurPage, y);
  }
  for (const x of [gauche, droite]) {
    trait(x, 0, x, longueur);
    trait(x, hauteurPage - longueur, x, hauteurPage);
  }
}

// L'image entière est dessinée, mise à l'échelle et décalée, sous un chemin de découpe
// au rectangle du cadre : seule la zone visible apparaît, et le JPEG n'est jamais réencodé.
function dessinerPhoto(
  page: PDFPage,
  image: PDFImage,
  emplacement: EmplacementARendre & { photo: PhotoARendre },
) {
  const cadre = prolongerParFondPerdu(emplacement);
  const zone = zoneVisible(emplacement.photo, cadre, {
    x: emplacement.cadrage_x,
    y: emplacement.cadrage_y,
    zoom: emplacement.cadrage_zoom,
  });
  const mmParPixel = cadre.largeur / zone.largeur;
  const imageEntiere = versPdf({
    x: cadre.x - zone.x * mmParPixel,
    y: cadre.y - zone.y * mmParPixel,
    largeur: emplacement.photo.largeur_px * mmParPixel,
    hauteur: emplacement.photo.hauteur_px * mmParPixel,
  });
  const decoupe = versPdf(cadre);

  page.pushOperators(
    pushGraphicsState(),
    rectangle(decoupe.x, decoupe.y, decoupe.width, decoupe.height),
    clip(),
    endPath(),
  );
  page.drawImage(image, imageEntiere);
  page.pushOperators(popGraphicsState());
}

// Rend le livre en PDF : une page par double page, fond perdu de 3 mm, traits de coupe.
// Les emplacements texte sont ignorés pour l'instant ; un emplacement photo vide est grisé.
export async function rendre(livre: LivreARendre): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  // Une photo posée deux fois n'est intégrée qu'une fois : le chargement partage ses octets.
  const images = new Map<Uint8Array, PDFImage>();
  const fond = couleur(livre.fond);

  for (const doublePage of livre.doubles_pages) {
    const page = document.addPage([pt(LARGEUR_PAGE_MM), pt(HAUTEUR_PAGE_MM)]);
    poserBoites(page);
    page.drawRectangle({
      ...versPdf({
        x: -FOND_PERDU_MM,
        y: -FOND_PERDU_MM,
        largeur: LARGEUR_DOUBLE_PAGE_MM + 2 * FOND_PERDU_MM,
        hauteur: HAUTEUR_DOUBLE_PAGE_MM + 2 * FOND_PERDU_MM,
      }),
      color: fond,
    });

    for (const emplacement of doublePage.emplacements) {
      if (emplacement.nature !== "photo") {
        continue;
      }
      const { photo } = emplacement;
      if (!photo) {
        page.drawRectangle({
          ...versPdf(emplacement),
          color: GRIS_EMPLACEMENT_VIDE,
        });
        continue;
      }
      let image = images.get(photo.octets);
      if (!image) {
        image = await document.embedJpg(photo.octets);
        images.set(photo.octets, image);
      }
      dessinerPhoto(page, image, { ...emplacement, photo });
    }

    tracerTraitsDeCoupe(page);
  }

  return document.save();
}
