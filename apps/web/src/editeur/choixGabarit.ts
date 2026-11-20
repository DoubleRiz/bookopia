import {
  estVide,
  type GabaritAComposer,
  LARGEUR_DOUBLE_PAGE_MM,
} from "@bookopia/shared";
import type { DoublePageDuLivre } from "../api/doublesPages";

// Changer de gabarit recrée les cadres vides (RG-17) : on ne prévient que s'il y a à perdre.
export function aDuContenu(doublePage: DoublePageDuLivre): boolean {
  return doublePage.emplacement.some(
    (emplacement) =>
      emplacement.photo_id !== null || !estVide(emplacement.contenu_texte),
  );
}

// Ce que deviendra la double page avec ce gabarit : ses cadres, vides, au même rang.
// Un dessin seulement : les identifiants sont inventés, rien n'est écrit.
export function apercuDuGabarit(
  gabarit: GabaritAComposer,
  position: number | null,
): DoublePageDuLivre {
  return {
    id: `apercu-${gabarit.id}`,
    role: "interieur",
    position,
    gabarit_origine_id: gabarit.id,
    emplacement: gabarit.definition.map(({ style, ...cadre }) => ({
      ...cadre,
      style_texte: style ?? null,
      id: `apercu-${gabarit.id}-${cadre.indice}`,
      photo_id: null,
      cadrage_x: null,
      cadrage_y: null,
      cadrage_zoom: null,
      contenu_texte: null,
    })),
  };
}

function compter(nombre: number, mot: string): string {
  return `${nombre} ${mot}${nombre > 1 ? "s" : ""}`;
}

// « 2 photos », « 1 photo · 2 textes » : les textes ne sont nommés que s'il y en a.
export function resumeDuGabarit(gabarit: GabaritAComposer): string {
  const photos = gabarit.definition.filter((c) => c.nature === "photo").length;
  const textes = gabarit.definition.length - photos;
  return textes > 0
    ? `${compter(photos, "photo")} · ${compter(textes, "texte")}`
    : compter(photos, "photo");
}

export type GroupeDeGabarits = { titre: string; gabarits: GabaritAComposer[] };

function nombreDePhotos(gabarit: GabaritAComposer): number {
  return gabarit.definition.filter((cadre) => cadre.nature === "photo").length;
}

// La disposition à plat, indépendante de l'ordre des cadres : deux gabarits qui se superposent
// cadre pour cadre ont la même empreinte. `miroir` la lit comme si les pages droite et gauche
// étaient échangées (même axe que le pli).
// Les cotes sont arrondies au centième de mm : 420 - 12.3 - 188.4 vaut 219.29999… en flottants.
const auCentieme = (mm: number) => Math.round(mm * 100) / 100;

function empreinte(gabarit: GabaritAComposer, miroir: boolean): string {
  return gabarit.definition
    .map((cadre) => {
      const x = miroir
        ? LARGEUR_DOUBLE_PAGE_MM - cadre.x - cadre.largeur
        : cadre.x;
      const style = "style" in cadre ? cadre.style : "";
      return [
        cadre.nature,
        style,
        ...[x, cadre.y, cadre.largeur, cadre.hauteur].map(auCentieme),
      ].join(":");
    })
    .sort()
    .join("|");
}

// Classe tous les gabarits pour la popup : sans texte puis avec texte, du plus simple au plus
// riche en photos, chaque gabarit suivi de sa version miroir. Un gabarit symétrique est son
// propre miroir : il n'a pas de partenaire.
export function classerLesGabarits(
  gabarits: GabaritAComposer[],
): GroupeDeGabarits[] {
  const tries = [...gabarits].sort(
    (a, b) =>
      nombreDePhotos(a) - nombreDePhotos(b) || a.nom.localeCompare(b.nom, "fr"),
  );
  const parEmpreinte = (miroir: boolean) =>
    new Map(tries.map((g) => [empreinte(g, miroir), g]));
  const originaux = parEmpreinte(false);

  const classes: GabaritAComposer[] = [];
  const places = new Set<string>();
  for (const gabarit of tries) {
    if (places.has(gabarit.id)) continue;
    classes.push(gabarit);
    places.add(gabarit.id);
    const partenaire = originaux.get(empreinte(gabarit, true));
    if (partenaire && !places.has(partenaire.id)) {
      classes.push(partenaire);
      places.add(partenaire.id);
    }
  }

  const sansTexte = classes.filter(
    (g) => nombreDePhotos(g) === g.definition.length,
  );
  const avecTexte = classes.filter(
    (g) => nombreDePhotos(g) < g.definition.length,
  );
  return [
    { titre: "Sans texte", gabarits: sansTexte },
    { titre: "Avec texte", gabarits: avecTexte },
  ].filter((groupe) => groupe.gabarits.length > 0);
}
