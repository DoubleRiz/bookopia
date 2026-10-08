import type { Cadrage, DocumentTexte } from "@bookopia/shared";
import type {
  DoublePageDuLivre,
  EmplacementDuLivre,
} from "../api/doublesPages";

// L'état de l'éditeur, dans le navigateur : les doubles pages telles qu'affichées et
// l'emplacement sélectionné. La base reste la référence : un geste refusé est rétabli.
export type EtatEditeur = {
  doublesPages: DoublePageDuLivre[];
  selection: string | null;
};

export type ActionEditeur =
  | { type: "poser"; emplacementId: string; photoId: string }
  | { type: "vider"; emplacementId: string }
  | { type: "recadrer"; emplacementId: string; cadrage: Cadrage }
  | {
      type: "ecrireTexte";
      emplacementId: string;
      contenu: DocumentTexte | null;
    }
  | { type: "retablir"; emplacement: EmplacementDuLivre }
  | { type: "remplacerDoublesPages"; doublesPages: DoublePageDuLivre[] }
  | { type: "selectionner"; emplacementId: string | null };

// Cadrage d'une photo qu'on vient de poser : centrée, sans zoom. Même valeur que composer_livre.
export const CADRAGE_NEUTRE: Cadrage = { x: 0.5, y: 0.5, zoom: 1 };

export function etatInitial(doublesPages: DoublePageDuLivre[]): EtatEditeur {
  return { doublesPages, selection: null };
}

export function emplacementDe(
  etat: EtatEditeur,
  emplacementId: string,
): EmplacementDuLivre | undefined {
  for (const doublePage of etat.doublesPages) {
    const trouve = doublePage.emplacement.find((e) => e.id === emplacementId);
    if (trouve) return trouve;
  }
  return undefined;
}

// Remplace un emplacement sans toucher aux autres objets : React ne redessine que ce qui a changé.
function modifierEmplacement(
  etat: EtatEditeur,
  emplacementId: string,
  modifier: (emplacement: EmplacementDuLivre) => EmplacementDuLivre,
): EtatEditeur {
  return {
    ...etat,
    doublesPages: etat.doublesPages.map((doublePage) =>
      doublePage.emplacement.some((e) => e.id === emplacementId)
        ? {
            ...doublePage,
            emplacement: doublePage.emplacement.map((e) =>
              e.id === emplacementId ? modifier(e) : e,
            ),
          }
        : doublePage,
    ),
  };
}

export function reduireEditeur(
  etat: EtatEditeur,
  action: ActionEditeur,
): EtatEditeur {
  switch (action.type) {
    // Poser écrase l'ancien cadrage : il valait pour une autre photo.
    case "poser":
      return modifierEmplacement(etat, action.emplacementId, (e) => ({
        ...e,
        photo_id: action.photoId,
        cadrage_x: CADRAGE_NEUTRE.x,
        cadrage_y: CADRAGE_NEUTRE.y,
        cadrage_zoom: CADRAGE_NEUTRE.zoom,
      }));
    // Vider garde le cadrage, comme la contrainte emplacement_coherence_nature le permet.
    case "vider":
      return modifierEmplacement(etat, action.emplacementId, (e) => ({
        ...e,
        photo_id: null,
      }));
    case "recadrer":
      return modifierEmplacement(etat, action.emplacementId, (e) => ({
        ...e,
        cadrage_x: action.cadrage.x,
        cadrage_y: action.cadrage.y,
        cadrage_zoom: action.cadrage.zoom,
      }));
    // Un cadre vidé de son texte est vide en base : null, pas un document sans texte.
    case "ecrireTexte":
      return modifierEmplacement(etat, action.emplacementId, (e) => ({
        ...e,
        contenu_texte: action.contenu,
      }));
    case "retablir":
      return modifierEmplacement(
        etat,
        action.emplacement.id,
        () => action.emplacement,
      );
    case "remplacerDoublesPages": {
      const suivant = { ...etat, doublesPages: action.doublesPages };
      return etat.selection && !emplacementDe(suivant, etat.selection)
        ? { ...suivant, selection: null }
        : suivant;
    }
    case "selectionner":
      return { ...etat, selection: action.emplacementId };
  }
}
