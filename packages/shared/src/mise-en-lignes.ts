// Mise en lignes des textes, partagée par l'écran et le PDF : les deux coupent les lignes
// au même endroit, c'est ce qui garantit qu'un texte qui tient à l'écran tient à l'impression.
// Tout est en millimètres, dans le repère de la double page. Aucune police n'est lue ici :
// l'appelant fournit la mesure, ce module reste pur.

import { LARGEUR_DOUBLE_PAGE_MM, type Rectangle } from "./cadrage";
import type { StyleTexte } from "./gabarit";
import { type ClePolice, clePolice, type MesureTexte } from "./polices";
import {
  INTERLIGNE,
  MM_PAR_POINT,
  policeDuStyle,
  type Typographie,
} from "./typographie";

// Tolérance des comparaisons : la conversion point → mm ne tombe jamais juste.
const EPSILON_MM = 1e-6;
const POINTS_DE_SUSPENSION = "…";

export type TexteAPlacer = Rectangle & {
  style_texte: StyleTexte;
  contenu_texte: string | null;
};

export type LigneDisposee = {
  texte: string;
  // Point d'ancrage de la ligne de base : bord gauche, milieu ou bord droit selon l'ancre.
  x: number;
  y: number;
};

export type TexteDispose = {
  // Le thème cache ce style : le texte reste en base, il n'est pas dessiné.
  masque: boolean;
  deborde: boolean;
  police: ClePolice;
  taille_mm: number;
  interligne_mm: number;
  ancre: "debut" | "milieu" | "fin";
  lignes: LigneDisposee[];
};

export type Mesures = (police: ClePolice) => MesureTexte;

const tient = (largeur: number, largeurMax: number) =>
  largeur <= largeurMax + EPSILON_MM;

// Coupe un paragraphe sans espace : autant de caractères que possible par ligne.
function couperLeMot(
  mot: string,
  largeurMax: number,
  taille_mm: number,
  mesure: MesureTexte,
): string[] {
  const morceaux: string[] = [];
  let morceau = "";
  for (const caractere of mot) {
    const candidat = morceau + caractere;
    if (morceau && !tient(mesure.largeur(candidat, taille_mm), largeurMax)) {
      morceaux.push(morceau);
      morceau = caractere;
    } else {
      morceau = candidat;
    }
  }
  morceaux.push(morceau);
  return morceaux;
}

// Coupure gloutonne aux espaces. Les retours à la ligne du Créateur sont respectés ;
// un mot plus large que le cadre est coupé caractère par caractère ;
// l'espace de fin de ligne ne compte pas.
export function mettreEnLignes(
  texte: string,
  largeurMax: number,
  taille_mm: number,
  mesure: MesureTexte,
): string[] {
  if (texte === "") return [];
  const largeur = (ligne: string) => mesure.largeur(ligne.trimEnd(), taille_mm);
  const lignes: string[] = [];

  for (const paragraphe of texte.split("\n")) {
    let ligne = "";
    for (const [rang, mot] of paragraphe.split(" ").entries()) {
      const candidat = rang === 0 ? mot : `${ligne} ${mot}`;
      if (tient(largeur(candidat), largeurMax)) {
        ligne = candidat;
        continue;
      }
      if (ligne.trimEnd()) lignes.push(ligne.trimEnd());
      const morceaux = couperLeMot(mot, largeurMax, taille_mm, mesure);
      lignes.push(...morceaux.slice(0, -1));
      ligne = morceaux.at(-1) ?? "";
    }
    lignes.push(ligne.trimEnd());
  }
  return lignes;
}

type Contexte = Omit<TexteDispose, "lignes" | "deborde"> & {
  mesure: MesureTexte;
  cadre: Rectangle;
  ancrage: Typographie["ancrage"];
};

function contexte(
  emplacement: TexteAPlacer,
  typographie: Typographie,
  mesures: Mesures,
): Contexte {
  const police = policeDuStyle(typographie, emplacement.style_texte);
  const cle = clePolice(police);
  if (!cle) {
    throw new Error(
      `Police absente du catalogue : ${police.police} ${police.graisse}`,
    );
  }
  const taille_mm = police.taille_pt * MM_PAR_POINT;
  const milieu = emplacement.x + emplacement.largeur / 2;
  const ancre =
    typographie.alignement === "gauche"
      ? "debut"
      : typographie.alignement === "centre"
        ? "milieu"
        : milieu < LARGEUR_DOUBLE_PAGE_MM / 2
          ? "debut"
          : "fin";
  return {
    masque: typographie.styles_masques.includes(emplacement.style_texte),
    police: cle,
    taille_mm,
    interligne_mm: taille_mm * INTERLIGNE,
    ancre,
    mesure: mesures(cle),
    cadre: emplacement,
    ancrage: typographie.ancrage,
  };
}

// Positionne des lignes déjà coupées. Chaque ligne occupe une hauteur d'interligne, le glyphe
// centré dedans (demi-interligne au-dessus et au-dessous), comme dans une zone de texte HTML :
// la saisie dans le cadre et le dessin tombent au même endroit.
function positionner(lignes: string[], ctx: Contexte): LigneDisposee[] {
  const { cadre, taille_mm, interligne_mm, mesure } = ctx;
  const haut =
    ctx.ancrage === "haut"
      ? cadre.y
      : cadre.y + cadre.hauteur - lignes.length * interligne_mm;
  const demiInterligne =
    (interligne_mm - (mesure.ascendant + mesure.descendant) * taille_mm) / 2;
  const x =
    ctx.ancre === "debut"
      ? cadre.x
      : ctx.ancre === "milieu"
        ? cadre.x + cadre.largeur / 2
        : cadre.x + cadre.largeur;
  return lignes.map((texte, rang) => ({
    texte,
    x,
    y:
      haut +
      rang * interligne_mm +
      demiInterligne +
      mesure.ascendant * taille_mm,
  }));
}

function lignesDe(texte: string | null, ctx: Contexte): string[] {
  return mettreEnLignes(
    texte ?? "",
    ctx.cadre.largeur,
    ctx.taille_mm,
    ctx.mesure,
  );
}

const tientEnHauteur = (nombre: number, ctx: Contexte) =>
  nombre * ctx.interligne_mm <= ctx.cadre.hauteur + EPSILON_MM;

function resultat(
  ctx: Contexte,
  lignes: string[],
  deborde: boolean,
): TexteDispose {
  const { masque, police, taille_mm, interligne_mm, ancre } = ctx;
  return {
    masque,
    deborde,
    police,
    taille_mm,
    interligne_mm,
    ancre,
    lignes: positionner(lignes, ctx),
  };
}

// Toutes les lignes du texte, qu'elles tiennent ou non : la saisie en a besoin pour savoir
// si le cadre est plein.
export function disposerTexte(
  emplacement: TexteAPlacer,
  typographie: Typographie,
  mesures: Mesures,
): TexteDispose {
  const ctx = contexte(emplacement, typographie, mesures);
  const lignes = lignesDe(emplacement.contenu_texte, ctx);
  return resultat(ctx, lignes, !tientEnHauteur(lignes.length, ctx));
}

// Ce qui se dessine : les lignes qui tiennent, la dernière terminée par « … » si le texte
// est plus long. Le PDF ne dessine jamais hors du cadre, quoi qu'il y ait en base.
export function tronquerPourTenir(
  emplacement: TexteAPlacer,
  typographie: Typographie,
  mesures: Mesures,
): TexteDispose {
  const ctx = contexte(emplacement, typographie, mesures);
  const lignes = lignesDe(emplacement.contenu_texte, ctx);
  if (tientEnHauteur(lignes.length, ctx)) {
    return resultat(ctx, lignes, false);
  }
  const nombre = Math.floor(
    (ctx.cadre.hauteur + EPSILON_MM) / ctx.interligne_mm,
  );
  const gardees = lignes.slice(0, nombre);
  const derniere = gardees.pop();
  if (derniere === undefined) return resultat(ctx, [], true);

  let raccourcie = derniere;
  while (
    raccourcie &&
    !tient(
      ctx.mesure.largeur(raccourcie + POINTS_DE_SUSPENSION, ctx.taille_mm),
      ctx.cadre.largeur,
    )
  ) {
    raccourcie = raccourcie.slice(0, -1).trimEnd();
  }
  return resultat(ctx, [...gardees, raccourcie + POINTS_DE_SUSPENSION], true);
}

// Le plus long début du texte qui tient dans le cadre : ce qu'on garde d'un collage trop long.
export function prefixeQuiTient(
  emplacement: TexteAPlacer,
  typographie: Typographie,
  mesures: Mesures,
  texte: string,
): string {
  const ctx = contexte(emplacement, typographie, mesures);
  const tientAvec = (longueur: number) =>
    tientEnHauteur(lignesDe(texte.slice(0, longueur), ctx).length, ctx);
  let bas = 0;
  let haut = texte.length;
  while (bas < haut) {
    const milieu = Math.ceil((bas + haut) / 2);
    if (tientAvec(milieu)) bas = milieu;
    else haut = milieu - 1;
  }
  return texte.slice(0, bas);
}
