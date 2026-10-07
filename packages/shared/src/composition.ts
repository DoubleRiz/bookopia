import type { Cadre, DefinitionGabarit } from "./gabarit";

// Le moteur de gabarits : choisit la suite de doubles pages intérieures qui pose toutes les photos,
// dans l'ordre de prise de vue, en recadrant le moins. Fonction pure : composer_livre vérifie
// et écrit le résultat, la base ne le calcule pas.

export type PhotoAComposer = {
  id: string;
  largeur_px: number;
  hauteur_px: number;
  prise_le: string | null;
  cree_le: string;
};

// Intérieurs actifs de la famille du livre, définition déjà validée par Zod.
export type GabaritAComposer = {
  id: string;
  nom: string;
  definition: DefinitionGabarit;
};

export type DoublePageComposee = {
  gabarit_id: string;
  poses: { indice: number; photo_id: string }[];
};

// Deux doubles pages consécutives au même gabarit : le livre paraît monotone. La pénalité vaut
// une demi-photo perdue : on accepte de recadrer un peu plus pour varier, pas beaucoup plus.
export const PENALITE_REPETITION = 0.5;

// Un cadre photo vide coûte plus que la pire double page entière (six photos, chacune moins
// d'une image perdue) : le moteur n'en laisse que lorsqu'aucune suite ne tombe juste.
export const PENALITE_CADRE_VIDE = 6;

// Les coûts sont des flottants : deux suites à égalité ne doivent pas se départager à l'arrondi.
const EPSILON = 1e-9;

// Part de l'image perdue quand la photo remplit le cadre : 0 aux mêmes proportions,
// 0,75 pour une photo 3:4 dans un panoramique 3:1.
export function coutDuCadre(
  photo: Pick<PhotoAComposer, "largeur_px" | "hauteur_px">,
  cadre: Pick<Cadre, "largeur" | "hauteur">,
): number {
  const rp = photo.largeur_px / photo.hauteur_px;
  const rc = cadre.largeur / cadre.hauteur;
  return 1 - Math.min(rp / rc, rc / rp);
}

// Par date de prise de vue ; les photos sans date ensuite, par date d'import ; l'identifiant départage.
function ordonner(photos: PhotoAComposer[]): PhotoAComposer[] {
  const instant = (date: string | null) =>
    date === null ? Number.POSITIVE_INFINITY : Date.parse(date);
  return [...photos].sort(
    (a, b) =>
      instant(a.prise_le) - instant(b.prise_le) ||
      Date.parse(a.cree_le) - Date.parse(b.cree_le) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

type Repartition = { cout: number; indices: number[] };

// Lecture d'un tableau que le moteur a lui-même rempli : un trou serait une erreur de programmation.
function lire<T>(valeurs: readonly T[], rang: number): T {
  const valeur = valeurs[rang];
  if (valeur === undefined) {
    throw new Error(`Rang ${rang} absent`);
  }
  return valeur;
}

// Essaie toutes les façons de poser les photos dans des cadres distincts (au plus 6! = 720)
// et garde la moins coûteuse. Cadres parcourus par indice : à égalité, le premier essai gagne.
function meilleureRepartition(
  photos: PhotoAComposer[],
  cadres: Cadre[],
): Repartition {
  let meilleure: Repartition = { cout: Number.POSITIVE_INFINITY, indices: [] };
  const indices: number[] = [];

  const essayer = (
    restantes: PhotoAComposer[],
    libres: Cadre[],
    cout: number,
  ) => {
    if (cout >= meilleure.cout - EPSILON) {
      return;
    }
    const [photo, ...suivantes] = restantes;
    if (!photo) {
      meilleure = { cout, indices: [...indices] };
      return;
    }
    for (const cadre of libres) {
      indices.push(cadre.indice);
      essayer(
        suivantes,
        libres.filter((autre) => autre !== cadre),
        cout + coutDuCadre(photo, cadre),
      );
      indices.pop();
    }
  };

  essayer(photos, cadres, 0);
  return meilleure;
}

type Choix = { cout: number; gabarit: number; repartition: Repartition };

export function composerLivre(
  photos: PhotoAComposer[],
  gabarits: GabaritAComposer[],
): DoublePageComposee[] {
  const ordre = ordonner(photos);
  const candidats = [...gabarits]
    .sort(
      (a, b) =>
        a.nom.localeCompare(b.nom, "fr") ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .map((gabarit) => ({
      id: gabarit.id,
      cadres: gabarit.definition
        .filter((cadre) => cadre.nature === "photo")
        .sort((a, b) => a.indice - b.indice),
      // La répartition d'une double page ne dépend que du gabarit et du rang de sa première photo.
      repartitions: new Map<number, Repartition>(),
    }))
    .filter((gabarit) => gabarit.cadres.length > 0);

  const n = ordre.length;
  const g = candidats.length;
  if (n === 0 || g === 0) {
    return [];
  }

  const repartition = (candidat: (typeof candidats)[number], rang: number) => {
    let resultat = candidat.repartitions.get(rang);
    if (!resultat) {
      resultat = meilleureRepartition(
        ordre.slice(rang, rang + candidat.cadres.length),
        candidat.cadres,
      );
      candidat.repartitions.set(rang, resultat);
    }
    return resultat;
  };

  // meilleur[rang][precedent] : la fin de livre la moins coûteuse quand les photos avant « rang »
  // sont posées et que la double page précédente utilise le gabarit « precedent »
  // (g pour « aucune », avant la première). Remplie de la fin vers le début.
  const fin: Choix = {
    cout: 0,
    gabarit: -1,
    repartition: { cout: 0, indices: [] },
  };
  const meilleur: Choix[][] = [];
  meilleur[n] = Array.from({ length: g + 1 }, () => fin);

  for (let rang = n - 1; rang >= 0; rang -= 1) {
    const ligne: Choix[] = [];
    for (let precedent = 0; precedent <= g; precedent += 1) {
      let choix = fin;
      candidats.forEach((candidat, gabarit) => {
        const posees = Math.min(candidat.cadres.length, n - rang);
        const page = repartition(candidat, rang);
        const cout =
          page.cout +
          (candidat.cadres.length - posees) * PENALITE_CADRE_VIDE +
          (gabarit === precedent ? PENALITE_REPETITION : 0) +
          lire(lire(meilleur, rang + posees), gabarit).cout;
        if (choix === fin || cout < choix.cout - EPSILON) {
          choix = { cout, gabarit, repartition: page };
        }
      });
      ligne.push(choix);
    }
    meilleur[rang] = ligne;
  }

  const livre: DoublePageComposee[] = [];
  let rang = 0;
  let precedent = g;
  while (rang < n) {
    const choix = lire(lire(meilleur, rang), precedent);
    livre.push({
      gabarit_id: lire(candidats, choix.gabarit).id,
      poses: choix.repartition.indices.map((indice, position) => ({
        indice,
        photo_id: lire(ordre, rang + position).id,
      })),
    });
    rang += choix.repartition.indices.length;
    precedent = choix.gabarit;
  }
  return livre;
}
