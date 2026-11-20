import { useEffect } from "react";
import { type UIMatch, useMatches } from "react-router";

// Titre d'un écran, déclaré dans le handle de sa route (routeur.tsx). Une fonction reçoit les données
// du loader de la route, pour reprendre le nom du livre ; elles manquent si ce loader a échoué.
export interface AvecTitre {
  titre: string | ((donnees: never) => string | undefined);
}

function titreDe({ handle, loaderData }: UIMatch): string | undefined {
  const titre = (handle as Partial<AvecTitre> | undefined)?.titre;
  if (typeof titre === "function") {
    return (titre as (donnees: unknown) => string | undefined)(loaderData);
  }
  return titre;
}

// Du plus précis au plus général, suivi de « Bookopia » (RGAA 8.6) :
// « Importer des photos · Bretagne · Bookopia ».
export function composerTitre(etapes: UIMatch[]): string {
  return [
    ...etapes
      .map(titreDe)
      .filter((titre) => titre)
      .reverse(),
    "Bookopia",
  ].join(" · ");
}

// Tient à jour le titre de l'onglet à chaque navigation.
export function useTitreDePage() {
  const titre = composerTitre(useMatches());
  useEffect(() => {
    document.title = titre;
  }, [titre]);
}
