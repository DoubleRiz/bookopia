// Mise en lignes des textes, partagée par l'écran et le PDF : les deux coupent les lignes
// au même endroit, c'est ce qui garantit qu'un texte qui tient à l'écran tient à l'impression.
// Tout est en millimètres, dans le repère de la double page. Aucune police n'est lue ici :
// l'appelant fournit la mesure, ce module reste pur.
//
// Le document est résolu segment par segment (écarts, sinon thème), coupé en mots mesurés avec
// leur propre police, puis assemblé en lignes de fragments positionnés. L'espacement entre les
// lettres est toujours nul : il casserait les liaisons des scripts attachés.

import { LARGEUR_DOUBLE_PAGE_MM, type Rectangle } from "./cadrage";
import type { StyleTexte } from "./gabarit";
import {
  CATALOGUE_POLICES,
  type ClePolice,
  clePolice,
  type MesureTexte,
  varianteDePolice,
} from "./polices";
import {
  type BlocTexte,
  type DocumentTexte,
  documentDepuisTexte,
  elementsDuBloc,
  type SegmentTexte,
} from "./texte-riche";
import {
  INTERLIGNE,
  MM_PAR_POINT,
  policeDuStyle,
  type Theme,
} from "./typographie";

// Tolérance des comparaisons : la conversion point → mm ne tombe jamais juste.
const EPSILON_MM = 1e-6;
const POINTS_DE_SUSPENSION = "…";
const PUCE = "•";
// Retrait fixe des listes : la puce dans la marge, le texte et ses retours à la ligne après.
export const RETRAIT_PUCE_MM = 5;
// Le soulignement se place et s'épaissit proportionnellement à la taille, pour l'écran comme le PDF.
export const DECALAGE_SOULIGNEMENT = 0.12;
export const EPAISSEUR_SOULIGNEMENT = 0.06;

export type TexteAPlacer = Rectangle & {
  style_texte: StyleTexte;
  contenu_texte: DocumentTexte | null;
};

// Un morceau de ligne d'un seul style : ce que l'écran et le PDF dessinent, tel quel.
export type Fragment = {
  texte: string;
  police: ClePolice;
  taille_mm: number;
  couleur: string;
  souligne: boolean;
  // Bord gauche du fragment et ligne de base, dans le repère de la double page.
  x: number;
  y: number;
  largeur: number;
};

export type LigneDisposee = {
  fragments: Fragment[];
  // Haut et hauteur de la ligne : l'interligne du plus grand corps qu'elle porte.
  haut: number;
  hauteur: number;
};

export type TexteDispose = {
  // Le thème cache ce style : le texte reste en base, il n'est pas dessiné.
  masque: boolean;
  deborde: boolean;
  lignes: LigneDisposee[];
};

export type Mesures = (police: ClePolice) => MesureTexte;

const tient = (largeur: number, largeurMax: number) =>
  largeur <= largeurMax + EPSILON_MM;

// Ce qui distingue deux passages à l'écran : la police, le corps, la couleur, le soulignement.
type Style = {
  police: ClePolice;
  taille_mm: number;
  couleur: string;
  souligne: boolean;
};

// Le style d'un passage une fois résolu, tel que l'écran et le PDF le dessinent.
export type StyleDePassage = Style;

type Morceau = { texte: string; style: Style; largeur: number };

type Resolveur = (segment: SegmentTexte) => Style;

function resolveur(
  theme: Theme,
  style_texte: StyleTexte,
): { resoudre: Resolveur; base: Style } {
  const police = policeDuStyle(theme.typographie, style_texte);
  const cle = clePolice(police);
  if (!cle) {
    throw new Error(
      `Police absente du catalogue : ${police.police} ${police.graisse}`,
    );
  }
  const base: Style = {
    police: cle,
    taille_mm: police.taille_pt * MM_PAR_POINT,
    couleur: theme.palette.texte,
    souligne: false,
  };
  const resoudre: Resolveur = (segment) => {
    const famille = segment.police ?? police.police;
    // Un segment qui change de famille part du régulier de cette famille ; sinon, de la police du thème.
    const depart = segment.police ? CATALOGUE_POLICES[famille].regulier : cle;
    const variante = varianteDePolice(
      famille,
      segment.gras ?? false,
      segment.italique ?? false,
    );
    return {
      police: variante ?? depart,
      taille_mm: segment.taille_pt
        ? segment.taille_pt * MM_PAR_POINT
        : base.taille_mm,
      couleur: segment.couleur ?? base.couleur,
      souligne: segment.souligne ?? false,
    };
  };
  return { resoudre, base };
}

const memeStyle = (a: Style, b: Style) =>
  a.police === b.police &&
  a.taille_mm === b.taille_mm &&
  a.couleur === b.couleur &&
  a.souligne === b.souligne;

// Un mot ne se coupe pas : ses morceaux (un par style) restent ensemble sur la ligne.
type Mot = { morceaux: Morceau[]; largeur: number };
type Jeton = { espace: boolean; mot: Mot };

function mesurer(
  texte: string,
  style: Style,
  mesures: Mesures,
  mesuresVues: Map<ClePolice, MesureTexte>,
): Morceau {
  let mesure = mesuresVues.get(style.police);
  if (!mesure) {
    mesure = mesures(style.police);
    mesuresVues.set(style.police, mesure);
  }
  return { texte, style, largeur: mesure.largeur(texte, style.taille_mm) };
}

// Des passages d'un même style côte à côte n'en font qu'un : un mot n'est jamais coupé entre deux.
function fusionner(
  segments: SegmentTexte[],
  resoudre: Resolveur,
): { texte: string; style: Style }[] {
  const passages: { texte: string; style: Style }[] = [];
  for (const segment of segments) {
    const style = resoudre(segment);
    const dernier = passages.at(-1);
    if (dernier && memeStyle(dernier.style, style))
      dernier.texte += segment.texte;
    else passages.push({ texte: segment.texte, style });
  }
  return passages;
}

function enJetons(
  passages: { texte: string; style: Style }[],
  mesures: Mesures,
  mesuresVues: Map<ClePolice, MesureTexte>,
): Jeton[] {
  const jetons: Jeton[] = [];
  let enCours: Mot | null = null;
  const clore = () => {
    if (enCours) jetons.push({ espace: false, mot: enCours });
    enCours = null;
  };
  for (const { texte, style } of passages) {
    for (const [rang, partie] of texte.split(/( +)/).entries()) {
      if (partie === "") continue;
      const morceau = mesurer(partie, style, mesures, mesuresVues);
      if (rang % 2 === 1) {
        clore();
        jetons.push({
          espace: true,
          mot: { morceaux: [morceau], largeur: morceau.largeur },
        });
      } else {
        enCours ??= { morceaux: [], largeur: 0 };
        enCours.morceaux.push(morceau);
        enCours.largeur += morceau.largeur;
      }
    }
  }
  clore();
  return jetons;
}

// Coupe un mot plus large que la ligne : autant de caractères que possible par ligne.
function couperLeMot(
  mot: Mot,
  largeurMax: number,
  mesures: Mesures,
  mesuresVues: Map<ClePolice, MesureTexte>,
): Mot[] {
  const pieces: Mot[] = [];
  let courant: Morceau[] = [];
  const largeurDe = (morceaux: Morceau[]) =>
    morceaux.reduce((somme, morceau) => somme + morceau.largeur, 0);
  for (const morceau of mot.morceaux) {
    for (const caractere of morceau.texte) {
      const dernier = courant.at(-1);
      const candidat =
        dernier && memeStyle(dernier.style, morceau.style)
          ? [
              ...courant.slice(0, -1),
              mesurer(
                dernier.texte + caractere,
                morceau.style,
                mesures,
                mesuresVues,
              ),
            ]
          : [
              ...courant,
              mesurer(caractere, morceau.style, mesures, mesuresVues),
            ];
      if (courant.length > 0 && !tient(largeurDe(candidat), largeurMax)) {
        pieces.push({ morceaux: courant, largeur: largeurDe(courant) });
        courant = [mesurer(caractere, morceau.style, mesures, mesuresVues)];
      } else {
        courant = candidat;
      }
    }
  }
  pieces.push({ morceaux: courant, largeur: largeurDe(courant) });
  return pieces;
}

// Une ligne avant positionnement : ses morceaux, le retrait et l'alignement du bloc.
type LigneBrute = {
  morceaux: Morceau[];
  alignement: "debut" | "milieu" | "fin";
  retrait: number;
  puce: Morceau | null;
  // Le corps qui fixe la hauteur de la ligne : le plus grand, ou celui du thème si elle est vide.
  reference: Style;
};

const largeurDesMorceaux = (morceaux: Morceau[]) =>
  morceaux.reduce((somme, morceau) => somme + morceau.largeur, 0);

// Coupure gloutonne aux espaces. Un espace n'est posé qu'entre deux mots d'une même ligne :
// celui de fin de ligne ne compte pas, celui de début de ligne non plus.
function couperEnLignes(
  jetons: Jeton[],
  largeurMax: number,
  mesures: Mesures,
  mesuresVues: Map<ClePolice, MesureTexte>,
): Morceau[][] {
  const lignes: Morceau[][] = [];
  let ligne: Morceau[] = [];
  let largeur = 0;
  const terminer = () => {
    lignes.push(ligne);
    ligne = [];
    largeur = 0;
  };

  let espace: Mot | null = null;
  for (const jeton of jetons) {
    if (jeton.espace) {
      espace = jeton.mot;
      continue;
    }
    const { mot } = jeton;
    const largeurEspace = ligne.length > 0 && espace ? espace.largeur : 0;
    if (tient(largeur + largeurEspace + mot.largeur, largeurMax)) {
      if (largeurEspace > 0 && espace) ligne.push(...espace.morceaux);
      ligne.push(...mot.morceaux);
      largeur += largeurEspace + mot.largeur;
    } else {
      if (ligne.length > 0) terminer();
      if (tient(mot.largeur, largeurMax)) {
        ligne = [...mot.morceaux];
        largeur = mot.largeur;
      } else {
        const pieces = couperLeMot(mot, largeurMax, mesures, mesuresVues);
        for (const piece of pieces.slice(0, -1)) {
          ligne = [...piece.morceaux];
          terminer();
        }
        const derniere = pieces.at(-1);
        ligne = derniere ? [...derniere.morceaux] : [];
        largeur = derniere?.largeur ?? 0;
      }
    }
    espace = null;
  }
  if (ligne.length > 0) terminer();
  return lignes;
}

type Contexte = {
  masque: boolean;
  base: Style;
  cadre: Rectangle;
  ancrage: "haut" | "bas";
  alignementDuTheme: "debut" | "milieu" | "fin";
  resoudre: Resolveur;
  mesures: Mesures;
  mesuresVues: Map<ClePolice, MesureTexte>;
};

function contexte(
  emplacement: TexteAPlacer,
  theme: Theme,
  mesures: Mesures,
): Contexte {
  const { typographie } = theme;
  const { resoudre, base } = resolveur(theme, emplacement.style_texte);
  const milieu = emplacement.x + emplacement.largeur / 2;
  const alignementDuTheme =
    typographie.alignement === "gauche"
      ? "debut"
      : typographie.alignement === "centre"
        ? "milieu"
        : milieu < LARGEUR_DOUBLE_PAGE_MM / 2
          ? "debut"
          : "fin";
  return {
    masque: typographie.styles_masques.includes(emplacement.style_texte),
    base,
    cadre: emplacement,
    ancrage: typographie.ancrage,
    alignementDuTheme,
    resoudre,
    mesures,
    mesuresVues: new Map(),
  };
}

const ALIGNEMENTS_DE_BLOC = {
  gauche: "debut",
  centre: "milieu",
  droite: "fin",
} as const;

function lignesBrutes(
  document: DocumentTexte | null,
  ctx: Contexte,
): LigneBrute[] {
  if (!document) return [];
  const resultat: LigneBrute[] = [];
  const reference = (morceaux: Morceau[]) =>
    morceaux.reduce<Style>(
      (plus, morceau) =>
        morceau.style.taille_mm > plus.taille_mm ? morceau.style : plus,
      morceaux[0]?.style ?? ctx.base,
    );

  for (const bloc of document.blocs) {
    const estListe = bloc.type === "liste";
    const alignement = estListe
      ? "debut"
      : bloc.alignement
        ? ALIGNEMENTS_DE_BLOC[bloc.alignement]
        : ctx.alignementDuTheme;
    const retrait = estListe ? RETRAIT_PUCE_MM : 0;
    for (const segments of elementsDuBloc(bloc as BlocTexte)) {
      const passages = fusionner(segments, ctx.resoudre);
      const jetons = enJetons(passages, ctx.mesures, ctx.mesuresVues);
      const coupees = couperEnLignes(
        jetons,
        ctx.cadre.largeur - retrait,
        ctx.mesures,
        ctx.mesuresVues,
      );
      // Une ligne vide (paragraphe sans segment) garde la hauteur du corps du thème.
      const lignes = coupees.length > 0 ? coupees : [[]];
      for (const [rang, morceaux] of lignes.entries()) {
        const premier = passages[0]?.style ?? ctx.base;
        resultat.push({
          morceaux,
          alignement,
          retrait,
          puce:
            estListe && rang === 0
              ? mesurer(PUCE, premier, ctx.mesures, ctx.mesuresVues)
              : null,
          reference: reference(morceaux),
        });
      }
    }
  }
  return resultat;
}

const hauteurDeLigne = (ligne: LigneBrute) =>
  ligne.reference.taille_mm * INTERLIGNE;

const hauteurTotale = (lignes: LigneBrute[]) =>
  lignes.reduce((somme, ligne) => somme + hauteurDeLigne(ligne), 0);

const tientEnHauteur = (lignes: LigneBrute[], ctx: Contexte) =>
  hauteurTotale(lignes) <= ctx.cadre.hauteur + EPSILON_MM;

// Positionne des lignes déjà coupées. Chaque ligne occupe l'interligne de son plus grand corps,
// le glyphe centré dedans (demi-interligne au-dessus et au-dessous), comme dans une zone de texte
// HTML : la saisie dans le cadre et le dessin tombent au même endroit.
function positionner(lignes: LigneBrute[], ctx: Contexte): LigneDisposee[] {
  const { cadre } = ctx;
  let haut =
    ctx.ancrage === "haut"
      ? cadre.y
      : cadre.y + cadre.hauteur - hauteurTotale(lignes);
  return lignes.map((ligne) => {
    const hauteur = hauteurDeLigne(ligne);
    const mesure =
      ctx.mesuresVues.get(ligne.reference.police) ??
      ctx.mesures(ligne.reference.police);
    const taille = ligne.reference.taille_mm;
    const demiInterligne =
      (hauteur - (mesure.ascendant + mesure.descendant) * taille) / 2;
    const base = haut + demiInterligne + mesure.ascendant * taille;

    const largeur = largeurDesMorceaux(ligne.morceaux);
    const disponible = cadre.largeur - ligne.retrait;
    const debut =
      cadre.x +
      ligne.retrait +
      (ligne.alignement === "debut"
        ? 0
        : ligne.alignement === "milieu"
          ? (disponible - largeur) / 2
          : disponible - largeur);

    // Les morceaux d'un même style se rejoignent : un fragment par passage, pas un par mot.
    const fragments: Fragment[] = [];
    let x = debut;
    for (const morceau of ligne.morceaux) {
      const precedent = fragments.at(-1);
      if (precedent && fragmentDeMemeStyle(precedent, morceau)) {
        precedent.texte += morceau.texte;
        precedent.largeur += morceau.largeur;
      } else {
        fragments.push({ ...fragmentDe(morceau), x, y: base });
      }
      x += morceau.largeur;
    }
    if (ligne.puce) {
      fragments.unshift({ ...fragmentDe(ligne.puce), x: cadre.x, y: base });
    }
    const resultat = { fragments, haut, hauteur };
    haut += hauteur;
    return resultat;
  });
}

const fragmentDeMemeStyle = (fragment: Fragment, morceau: Morceau) =>
  fragment.police === morceau.style.police &&
  fragment.taille_mm === morceau.style.taille_mm &&
  fragment.couleur === morceau.style.couleur &&
  fragment.souligne === morceau.style.souligne;

const fragmentDe = (morceau: Morceau) => ({
  texte: morceau.texte,
  police: morceau.style.police,
  taille_mm: morceau.style.taille_mm,
  couleur: morceau.style.couleur,
  souligne: morceau.style.souligne,
  largeur: morceau.largeur,
});

function resultat(
  ctx: Contexte,
  lignes: LigneBrute[],
  deborde: boolean,
): TexteDispose {
  return { masque: ctx.masque, deborde, lignes: positionner(lignes, ctx) };
}

// Toutes les lignes du texte, qu'elles tiennent ou non : la saisie en a besoin pour savoir
// si le cadre est plein.
export function disposerTexte(
  emplacement: TexteAPlacer,
  theme: Theme,
  mesures: Mesures,
): TexteDispose {
  const ctx = contexte(emplacement, theme, mesures);
  const lignes = lignesBrutes(emplacement.contenu_texte, ctx);
  return resultat(ctx, lignes, !tientEnHauteur(lignes, ctx));
}

// Termine la dernière ligne gardée par « … » : on retire des caractères à son dernier morceau
// jusqu'à ce que les points de suspension tiennent dans la largeur.
function terminerParSuspension(ligne: LigneBrute, ctx: Contexte): LigneBrute {
  const largeurMax = ctx.cadre.largeur - ligne.retrait;
  const morceaux = [...ligne.morceaux];
  const style = morceaux.at(-1)?.style ?? ligne.reference;
  // La suspension rejoint le dernier morceau quand elle a son style : un seul fragment, une seule mesure.
  const avecSuspension = (): Morceau[] => {
    const dernier = morceaux.at(-1);
    return dernier && memeStyle(dernier.style, style)
      ? [
          ...morceaux.slice(0, -1),
          mesurer(
            dernier.texte + POINTS_DE_SUSPENSION,
            style,
            ctx.mesures,
            ctx.mesuresVues,
          ),
        ]
      : [
          ...morceaux,
          mesurer(POINTS_DE_SUSPENSION, style, ctx.mesures, ctx.mesuresVues),
        ];
  };
  for (;;) {
    const candidat = avecSuspension();
    if (tient(largeurDesMorceaux(candidat), largeurMax)) {
      return { ...ligne, morceaux: candidat };
    }
    const dernier = morceaux.pop();
    if (!dernier) return { ...ligne, morceaux: candidat };
    const raccourci = dernier.texte.slice(0, -1).trimEnd();
    if (raccourci) {
      morceaux.push(
        mesurer(raccourci, dernier.style, ctx.mesures, ctx.mesuresVues),
      );
    }
  }
}

// Ce qui se dessine : les lignes qui tiennent, la dernière terminée par « … » si le texte
// est plus long. Le PDF ne dessine jamais hors du cadre, quoi qu'il y ait en base.
export function tronquerPourTenir(
  emplacement: TexteAPlacer,
  theme: Theme,
  mesures: Mesures,
): TexteDispose {
  const ctx = contexte(emplacement, theme, mesures);
  const lignes = lignesBrutes(emplacement.contenu_texte, ctx);
  if (tientEnHauteur(lignes, ctx)) return resultat(ctx, lignes, false);

  const gardees: LigneBrute[] = [];
  for (const ligne of lignes) {
    if (!tientEnHauteur([...gardees, ligne], ctx)) break;
    gardees.push(ligne);
  }
  const derniere = gardees.pop();
  if (derniere === undefined) return resultat(ctx, [], true);
  return resultat(
    ctx,
    [...gardees, terminerParSuspension(derniere, ctx)],
    true,
  );
}

// Le plus long début du texte qui tient dans le cadre : ce qu'on garde d'un collage trop long.
// Travaille sur le texte brut, sans mise en forme : les passages collés suivent le thème.
export function prefixeQuiTient(
  emplacement: TexteAPlacer,
  theme: Theme,
  mesures: Mesures,
  texte: string,
): string {
  const ctx = contexte(emplacement, theme, mesures);
  const tientAvec = (longueur: number) =>
    tientEnHauteur(
      lignesBrutes(documentDepuisTexte(texte.slice(0, longueur)), ctx),
      ctx,
    );
  let bas = 0;
  let haut = texte.length;
  while (bas < haut) {
    const milieu = Math.ceil((bas + haut) / 2);
    if (tientAvec(milieu)) bas = milieu;
    else haut = milieu - 1;
  }
  return texte.slice(0, bas);
}

// Ce qu'un passage devient à l'écran et dans le PDF : le fichier de police, le corps, la couleur.
// L'éditeur s'en sert pour habiller la saisie comme le rendu final.
export function styleDuSegment(
  segment: SegmentTexte,
  theme: Theme,
  style_texte: StyleTexte,
): StyleDePassage {
  return resolveur(theme, style_texte).resoudre(segment);
}

// Les fichiers de police qu'un texte demande : celui du thème et ceux de ses passages.
// Le chargement et l'éditeur s'en servent pour ne préparer que ce qui sera dessiné.
export function policesDuTexte(
  document: DocumentTexte | null,
  theme: Theme,
  style_texte: StyleTexte,
): ClePolice[] {
  const { resoudre, base } = resolveur(theme, style_texte);
  const cles = new Set<ClePolice>([base.police]);
  for (const bloc of document?.blocs ?? []) {
    for (const segments of elementsDuBloc(bloc)) {
      for (const segment of segments) cles.add(resoudre(segment).police);
    }
  }
  return [...cles];
}
