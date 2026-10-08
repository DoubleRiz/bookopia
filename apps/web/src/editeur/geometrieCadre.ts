import {
  HAUTEUR_DOUBLE_PAGE_MM,
  LARGEUR_DOUBLE_PAGE_MM,
} from "@bookopia/shared";

// La géométrie d'un cadre texte qu'on déplace ou qu'on redimensionne, en millimètres dans le
// repère de la double page. Les bornes sont celles de placer_cadre_texte, qui les revérifie.
export type Cadre = { x: number; y: number; largeur: number; hauteur: number };

export type Poignee =
  "corps" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const POIGNEES: Exclude<Poignee, "corps">[] = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
];

export const MARGE_MM = 12;
export const LARGEUR_MIN_MM = 20;
export const HAUTEUR_MIN_MM = 6;
export const GRILLE_MM = 2;
// Un bord à moins de cette distance du bord d'un autre cadre ou d'une marge s'y colle.
export const ACCROCHE_MM = 1;

const arrondir = (valeur: number) => Math.round(valeur * 100) / 100;

// Le bord d'un autre cadre ou d'une marge, s'il est assez près ; sinon la grille.
function accrocher(valeur: number, aimants: number[]): number {
  let meilleur: number | null = null;
  for (const aimant of aimants) {
    if (
      Math.abs(aimant - valeur) <= ACCROCHE_MM &&
      (meilleur === null ||
        Math.abs(aimant - valeur) < Math.abs(meilleur - valeur))
    ) {
      meilleur = aimant;
    }
  }
  return meilleur ?? Math.round(valeur / GRILLE_MM) * GRILLE_MM;
}

const borner = (valeur: number, bas: number, haut: number) =>
  Math.min(Math.max(valeur, bas), haut);

function aimantsX(autres: Cadre[]): number[] {
  return [
    MARGE_MM,
    LARGEUR_DOUBLE_PAGE_MM - MARGE_MM,
    ...autres.flatMap((cadre) => [cadre.x, cadre.x + cadre.largeur]),
  ];
}

function aimantsY(autres: Cadre[]): number[] {
  return [
    MARGE_MM,
    HAUTEUR_DOUBLE_PAGE_MM - MARGE_MM,
    ...autres.flatMap((cadre) => [cadre.y, cadre.y + cadre.hauteur]),
  ];
}

// Deux rectangles se chevauchent quand ils se recouvrent sur les deux axes ; des bords qui se
// touchent ne comptent pas. C'est la règle de placer_cadre_texte.
export function chevauche(a: Cadre, b: Cadre): boolean {
  return (
    a.x < b.x + b.largeur &&
    a.x + a.largeur > b.x &&
    a.y < b.y + b.hauteur &&
    a.y + a.hauteur > b.y
  );
}

export function chevaucheUnAutre(cadre: Cadre, autres: Cadre[]): boolean {
  return autres.some((autre) => chevauche(cadre, autre));
}

// Le cadre après un glissement de (dx, dy) depuis `depart` : accroché, borné par les marges
// de sécurité et par la taille minimale. Il ne tient pas compte des chevauchements.
export function glisser(
  depart: Cadre,
  poignee: Poignee,
  dx: number,
  dy: number,
  autres: Cadre[],
): Cadre {
  const ax = aimantsX(autres);
  const ay = aimantsY(autres);
  const droiteMax = LARGEUR_DOUBLE_PAGE_MM - MARGE_MM;
  const basMax = HAUTEUR_DOUBLE_PAGE_MM - MARGE_MM;

  if (poignee === "corps") {
    // Le bord gauche (ou droit) qui s'accroche le mieux donne le décalage ; sans aimant, la grille.
    const decaler = (
      bas: number,
      taille: number,
      aimants: number[],
      max: number,
    ) => {
      const gauche = accrocher(bas, aimants);
      const droite = accrocher(bas + taille, aimants);
      const colleGauche = aimants.includes(gauche);
      const colleDroite = aimants.includes(droite);
      const valeur = colleDroite && !colleGauche ? droite - taille : gauche;
      return borner(valeur, MARGE_MM, max - taille);
    };
    return {
      x: arrondir(decaler(depart.x + dx, depart.largeur, ax, droiteMax)),
      y: arrondir(decaler(depart.y + dy, depart.hauteur, ay, basMax)),
      largeur: depart.largeur,
      hauteur: depart.hauteur,
    };
  }

  let gauche = depart.x;
  let droite = depart.x + depart.largeur;
  let haut = depart.y;
  let bas = depart.y + depart.hauteur;
  if (poignee.includes("w")) {
    gauche = borner(
      accrocher(depart.x + dx, ax),
      MARGE_MM,
      droite - LARGEUR_MIN_MM,
    );
  }
  if (poignee.includes("e")) {
    droite = borner(
      accrocher(droite + dx, ax),
      gauche + LARGEUR_MIN_MM,
      droiteMax,
    );
  }
  if (poignee.includes("n")) {
    haut = borner(accrocher(depart.y + dy, ay), MARGE_MM, bas - HAUTEUR_MIN_MM);
  }
  if (poignee.includes("s")) {
    bas = borner(accrocher(bas + dy, ay), haut + HAUTEUR_MIN_MM, basMax);
  }
  return {
    x: arrondir(gauche),
    y: arrondir(haut),
    largeur: arrondir(droite - gauche),
    hauteur: arrondir(bas - haut),
  };
}

// Une flèche pousse le cadre d'un pas de grille ; avec Maj, elle change sa taille.
export function pousser(
  cadre: Cadre,
  touche: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown",
  redimensionner: boolean,
): Cadre {
  const dx = touche === "ArrowLeft" ? -1 : touche === "ArrowRight" ? 1 : 0;
  const dy = touche === "ArrowUp" ? -1 : touche === "ArrowDown" ? 1 : 0;
  const droiteMax = LARGEUR_DOUBLE_PAGE_MM - MARGE_MM;
  const basMax = HAUTEUR_DOUBLE_PAGE_MM - MARGE_MM;
  if (redimensionner) {
    return {
      ...cadre,
      largeur: arrondir(
        borner(
          cadre.largeur + dx * GRILLE_MM,
          LARGEUR_MIN_MM,
          droiteMax - cadre.x,
        ),
      ),
      hauteur: arrondir(
        borner(
          cadre.hauteur + dy * GRILLE_MM,
          HAUTEUR_MIN_MM,
          basMax - cadre.y,
        ),
      ),
    };
  }
  return {
    ...cadre,
    x: arrondir(
      borner(cadre.x + dx * GRILLE_MM, MARGE_MM, droiteMax - cadre.largeur),
    ),
    y: arrondir(
      borner(cadre.y + dy * GRILLE_MM, MARGE_MM, basMax - cadre.hauteur),
    ),
  };
}

export const memeCadre = (a: Cadre, b: Cadre) =>
  a.x === b.x &&
  a.y === b.y &&
  a.largeur === b.largeur &&
  a.hauteur === b.hauteur;
