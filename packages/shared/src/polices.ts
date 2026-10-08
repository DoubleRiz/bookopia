import fontkit from "@pdf-lib/fontkit";

// Les polices des thèmes : un fichier TTF par graisse et style, dans packages/shared/polices.
// Les mêmes octets servent à l'écran, à la mesure et au PDF.
export const FICHIERS_POLICES = {
  "eb-garamond-500": "eb-garamond-500.ttf",
  "eb-garamond-400-italique": "eb-garamond-400-italique.ttf",
  "nunito-400": "nunito-400.ttf",
  "nunito-600": "nunito-600.ttf",
  "nunito-700": "nunito-700.ttf",
  "nunito-800": "nunito-800.ttf",
  "caveat-600": "caveat-600.ttf",
} as const;

export type ClePolice = keyof typeof FICHIERS_POLICES;

export const FAMILLES_POLICES = ["EB Garamond", "Nunito", "Caveat"] as const;

// Les variantes réelles de chaque famille. Une variante absente vaut null : le rendu ne fabrique
// ni faux gras ni faux italique, et l'éditeur grise le bouton correspondant.
export type VariantesPolice = {
  regulier: ClePolice;
  gras: ClePolice | null;
  italique: ClePolice | null;
  gras_italique: ClePolice | null;
};

export const CATALOGUE_POLICES: Record<
  (typeof FAMILLES_POLICES)[number],
  VariantesPolice
> = {
  "EB Garamond": {
    regulier: "eb-garamond-500",
    gras: null,
    italique: "eb-garamond-400-italique",
    gras_italique: null,
  },
  Nunito: {
    regulier: "nunito-400",
    gras: "nunito-700",
    italique: null,
    gras_italique: null,
  },
  Caveat: {
    regulier: "caveat-600",
    gras: null,
    italique: null,
    gras_italique: null,
  },
};

// La variante d'une famille pour un gras et un italique demandés. Sans la variante exacte,
// on retire d'abord l'italique puis le gras, jamais de simulation : null si rien ne convient.
export function varianteDePolice(
  famille: keyof typeof CATALOGUE_POLICES,
  gras: boolean,
  italique: boolean,
): ClePolice | null {
  const variantes = CATALOGUE_POLICES[famille];
  if (gras && italique && variantes.gras_italique)
    return variantes.gras_italique;
  if (gras && variantes.gras) return variantes.gras;
  if (italique && variantes.italique) return variantes.italique;
  return null;
}

export type Police = {
  police: (typeof FAMILLES_POLICES)[number];
  graisse: number;
  italique: boolean;
};

function estClePolice(cle: string): cle is ClePolice {
  return Object.hasOwn(FICHIERS_POLICES, cle);
}

// « EB Garamond » 400 italique → « eb-garamond-400-italique ». null si le fichier n'existe pas.
export function clePolice({
  police,
  graisse,
  italique,
}: Police): ClePolice | null {
  const cle = `${police.toLowerCase().replaceAll(" ", "-")}-${graisse}${italique ? "-italique" : ""}`;
  return estClePolice(cle) ? cle : null;
}

// Ce que la mise en lignes sait d'une police. Les hauteurs sont des fractions de la taille.
export type MesureTexte = {
  largeur: (texte: string, taille_mm: number) => number;
  ascendant: number;
  descendant: number;
};

// La largeur est celle que pdf-lib dessinera : la somme des chasses des glyphes après les
// substitutions de la police (ligatures), sans le crénage, que pdf-lib n'applique pas.
// Mesurer autrement couperait les lignes à un endroit que le PDF ne respecterait pas.
export function creerMesure(octets: Uint8Array): MesureTexte {
  const police = fontkit.create(octets);
  const parUnite = 1 / police.unitsPerEm;
  return {
    largeur(texte, taille_mm) {
      let unites = 0;
      for (const glyphe of police.layout(texte).glyphs) {
        unites += glyphe.advanceWidth;
      }
      return unites * parUnite * taille_mm;
    },
    ascendant: police.ascent * parUnite,
    descendant: -police.descent * parUnite,
  };
}
