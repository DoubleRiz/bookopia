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
