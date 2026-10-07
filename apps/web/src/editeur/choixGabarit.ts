import type { GabaritAComposer } from "@bookopia/shared";
import type { DoublePageDuLivre } from "../api/doublesPages";

// Changer de gabarit recrée les cadres vides (RG-17) : on ne prévient que s'il y a à perdre.
export function aDuContenu(doublePage: DoublePageDuLivre): boolean {
  return doublePage.emplacement.some(
    (emplacement) =>
      emplacement.photo_id !== null ||
      (emplacement.contenu_texte ?? "").trim() !== "",
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
