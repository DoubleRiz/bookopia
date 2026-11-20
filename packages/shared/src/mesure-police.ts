import fontkit from "@pdf-lib/fontkit";
import type { MesureTexte } from "./polices";

// Point d'entrée à part : fontkit pèse lourd, seul l'éditeur et l'export le chargent.
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
