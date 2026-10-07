import type { GabaritAComposer } from "@bookopia/shared";

function nombreDeCadresPhoto(gabarit: GabaritAComposer): number {
  return gabarit.definition.filter((cadre) => cadre.nature === "photo").length;
}

// Le gabarit d'une double page ajoutée : le plus simple de la famille, celui qui a le moins
// de cadres photo, à transformer ensuite. À égalité, le premier du catalogue (identifiants
// du seed, dans l'ordre). null si le catalogue est vide.
export function gabaritParDefaut(
  gabarits: GabaritAComposer[],
): GabaritAComposer | null {
  return (
    [...gabarits].sort(
      (a, b) =>
        nombreDeCadresPhoto(a) - nombreDeCadresPhoto(b) ||
        a.id.localeCompare(b.id),
    )[0] ?? null
  );
}
