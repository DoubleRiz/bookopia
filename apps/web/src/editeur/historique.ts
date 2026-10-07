import type { EmplacementDuLivre } from "../api/doublesPages";

// Un geste sur un emplacement, avec l'état d'avant et l'état d'après.
export type Entree = { avant: EmplacementDuLivre; apres: EmplacementDuLivre };

// L'historique d'annulation de l'éditeur, dans le navigateur. Il ne couvre que les gestes sur un
// emplacement ; les gestes de structure le vident (les états gardés ne vaudraient plus rien).
export type Historique = { passe: Entree[]; futur: Entree[] };

export const HISTORIQUE_VIDE: Historique = { passe: [], futur: [] };

// Au-delà, les gestes les plus anciens sont oubliés : la mémoire ne grandit pas avec la session.
export const PROFONDEUR_MAX = 50;

// Un nouveau geste efface ce qu'on pouvait refaire.
export function enregistrer(
  historique: Historique,
  entree: Entree,
): Historique {
  return {
    passe: [...historique.passe, entree].slice(-PROFONDEUR_MAX),
    futur: [],
  };
}

// Rend l'emplacement à écrire pour défaire le dernier geste, ou null s'il n'y en a pas.
export function annuler(
  historique: Historique,
): { historique: Historique; cible: EmplacementDuLivre } | null {
  const entree = historique.passe.at(-1);
  if (!entree) return null;
  return {
    cible: entree.avant,
    historique: {
      passe: historique.passe.slice(0, -1),
      futur: [...historique.futur, entree],
    },
  };
}

// Rend l'emplacement à écrire pour rejouer le dernier geste annulé, ou null s'il n'y en a pas.
export function refaire(
  historique: Historique,
): { historique: Historique; cible: EmplacementDuLivre } | null {
  const entree = historique.futur.at(-1);
  if (!entree) return null;
  return {
    cible: entree.apres,
    historique: {
      passe: [...historique.passe, entree],
      futur: historique.futur.slice(0, -1),
    },
  };
}
