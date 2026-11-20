import { useEffect, useRef } from "react";
import { type UIMatch, useMatches } from "react-router";

// Route ouverte par-dessus un écran (S1, E5), déclarée dans son handle (routeur.tsx) :
// elle garde le focus de sa fenêtre, l'écran dessous n'a pas changé.
export interface AvecSurcouche {
  surcouche: true;
}

// Adresse de l'écran affiché, sans la surcouche éventuelle : /livres pour /livres/nouveau.
// Les paramètres de recherche n'en font pas partie : filtrer ou revenir après connexion ne change pas d'écran.
export function adresseDeEcran(etapes: UIMatch[]): string {
  const ecran = etapes.findLast(
    (etape) => !(etape.handle as Partial<AvecSurcouche> | undefined)?.surcouche,
  );
  return ecran?.pathname ?? "";
}

// Un client-side routeur ne déplace pas le focus : il reste sur le lien cliqué, et un lecteur d'écran
// n'annonce rien (RGAA 7.5). Au changement d'écran, le focus va sur le titre principal, ou à défaut sur <main>.
export function useFocusDePage() {
  const ecran = adresseDeEcran(useMatches());
  const precedent = useRef(ecran);

  useEffect(() => {
    if (precedent.current === ecran) return;
    precedent.current = ecran;
    const cible =
      document.querySelector<HTMLElement>("h1") ??
      document.querySelector<HTMLElement>("main");
    if (!cible) return;
    // Sans tabindex, un titre n'est pas focalisable ; -1 le réserve au focus programmatique (hors ordre du Tab).
    cible.tabIndex = -1;
    cible.focus({ preventScroll: true });
  }, [ecran]);
}
