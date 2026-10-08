import {
  disposerTexte,
  estVide,
  type Mesures,
  type Theme,
} from "@bookopia/shared";
import type { DoublePageDuLivre } from "../api/doublesPages";

export type EffetDuTheme = { masques: number; coupes: number };

// Ce que le thème fera aux textes écrits du livre, couverture et 4e comprises : combien seront
// masqués, combien seront coupés à l'impression. Le texte reste en base dans les deux cas.
export function effetDuTheme(
  doublesPages: DoublePageDuLivre[],
  theme: Theme,
  mesures: Mesures,
): EffetDuTheme {
  const effet = { masques: 0, coupes: 0 };
  for (const doublePage of doublesPages) {
    for (const emplacement of doublePage.emplacement) {
      const { style_texte, contenu_texte } = emplacement;
      if (!style_texte || estVide(contenu_texte)) continue;
      const dispose = disposerTexte(
        { ...emplacement, style_texte },
        theme,
        mesures,
      );
      if (dispose.masque) effet.masques += 1;
      else if (dispose.deborde) effet.coupes += 1;
    }
  }
  return effet;
}

const compter = (nombre: number, singulier: string, pluriel: string) =>
  nombre === 1 ? `1 texte ${singulier}` : `${nombre} textes ${pluriel}`;

// « 3 textes seront masqués · 1 texte sera coupé » ; vide si rien ne change.
export function resumeDeLEffet({ masques, coupes }: EffetDuTheme): string {
  return [
    masques > 0 && compter(masques, "sera masqué", "seront masqués"),
    coupes > 0 && compter(coupes, "sera coupé", "seront coupés"),
  ]
    .filter(Boolean)
    .join(" · ");
}
