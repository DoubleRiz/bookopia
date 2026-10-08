import fontkit from "@pdf-lib/fontkit";
import {
  clip,
  endPath,
  PDFDocument,
  type PDFFont,
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
  placerPhoto,
  type Rectangle,
} from "./cadrage";
import type { StyleTexte } from "./gabarit";
import {
  DECALAGE_SOULIGNEMENT,
  EPAISSEUR_SOULIGNEMENT,
  tronquerPourTenir,
} from "./mise-en-lignes";
import { type ClePolice, creerMesure, type MesureTexte } from "./polices";
import { type DocumentTexte, estVide } from "./texte-riche";
import { type Theme } from "./typographie";

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
  // Cadres texte seulement ; null pour une photo.
  style_texte: StyleTexte | null;
  contenu_texte: DocumentTexte | null;
};

// Tout ce que le rendu doit savoir, déjà lu et téléchargé : aucun accès réseau ni base ici.
export type LivreARendre = {
  theme: Theme;
  // Les fichiers des polices du thème. Une police manquante fait échouer le rendu :
  // jamais de PDF avec une police de substitution.
  polices: Partial<Record<ClePolice, Uint8Array>>;
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
  const { cadre, zone } = placerPhoto(emplacement, emplacement.photo);
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

// Les polices du livre, intégrées à la première ligne qui s'en sert, en sous-ensemble :
// seuls les glyphes utilisés entrent dans le PDF.
function preparerPolices(document: PDFDocument, livre: LivreARendre) {
  const mesures = new Map<ClePolice, MesureTexte>();
  const integrees = new Map<ClePolice, Promise<PDFFont>>();
  const octetsDe = (cle: ClePolice) => {
    const octets = livre.polices[cle];
    if (!octets) throw new Error(`Police manquante : ${cle}`);
    return octets;
  };
  return {
    mesure(cle: ClePolice): MesureTexte {
      let mesure = mesures.get(cle);
      if (!mesure) {
        mesure = creerMesure(octetsDe(cle));
        mesures.set(cle, mesure);
      }
      return mesure;
    },
    integree(cle: ClePolice): Promise<PDFFont> {
      let police = integrees.get(cle);
      if (!police) {
        police = document.embedFont(octetsDe(cle), { subset: true });
        integrees.set(cle, police);
      }
      return police;
    },
  };
}

type Polices = ReturnType<typeof preparerPolices>;

// Les lignes qui tiennent dans le cadre, la dernière coupée par « … » si le texte est plus long.
// Un texte masqué par le thème ou vide n'est pas dessiné, ni son filet. Chaque fragment est
// dessiné dans sa police, sa taille et sa couleur ; drawText ne soulignant pas, le soulignement
// est un trait sous le fragment.
async function dessinerTexte(
  page: PDFPage,
  emplacement: EmplacementARendre,
  theme: Theme,
  polices: Polices,
) {
  const { style_texte, contenu_texte } = emplacement;
  if (!style_texte || estVide(contenu_texte)) return;
  const dispose = tronquerPourTenir(
    { ...emplacement, style_texte, contenu_texte },
    theme,
    polices.mesure,
  );
  if (dispose.masque || dispose.lignes.length === 0) return;

  const encre = couleur(theme.palette.texte);
  const filet = theme.bordure_cadre?.filet_pt;
  if (filet) {
    const { x, y, width } = versPdf({ ...emplacement, hauteur: 0 });
    page.drawLine({
      start: { x, y },
      end: { x: x + width, y },
      thickness: filet,
      color: encre,
    });
  }

  for (const ligne of dispose.lignes) {
    for (const fragment of ligne.fragments) {
      const x = pt(DECALAGE_COUPE_MM + fragment.x);
      const y = pt(DECALAGE_COUPE_MM + HAUTEUR_DOUBLE_PAGE_MM - fragment.y);
      const teinte = couleur(fragment.couleur);
      page.drawText(fragment.texte, {
        x,
        y,
        size: pt(fragment.taille_mm),
        font: await polices.integree(fragment.police),
        color: teinte,
      });
      if (fragment.souligne) {
        const dessous = y - pt(fragment.taille_mm * DECALAGE_SOULIGNEMENT);
        page.drawLine({
          start: { x, y: dessous },
          end: { x: x + pt(fragment.largeur), y: dessous },
          thickness: pt(fragment.taille_mm * EPAISSEUR_SOULIGNEMENT),
          color: teinte,
        });
      }
    }
  }
}

// Rend le livre en PDF : une page par double page, fond perdu de 3 mm, traits de coupe.
// Un emplacement photo vide est grisé ; un emplacement texte vide n'est pas dessiné.
export async function rendre(livre: LivreARendre): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const polices = preparerPolices(document, livre);
  // Une photo posée deux fois n'est intégrée qu'une fois : le chargement partage ses octets.
  const images = new Map<Uint8Array, PDFImage>();
  const fond = couleur(livre.theme.palette.fond);

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
      if (emplacement.nature === "texte") {
        await dessinerTexte(page, emplacement, livre.theme, polices);
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
