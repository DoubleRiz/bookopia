import { describe, expect, it } from "vitest";
import type { EmplacementDuLivre } from "../api/doublesPages";
import {
  annuler,
  enregistrer,
  HISTORIQUE_VIDE,
  PROFONDEUR_MAX,
  refaire,
} from "./historique";

const emplacement = (photoId: string | null): EmplacementDuLivre =>
  ({ id: "e1", photo_id: photoId }) as EmplacementDuLivre;

const entree = (avant: string | null, apres: string | null) => ({
  avant: emplacement(avant),
  apres: emplacement(apres),
});

describe("historique", () => {
  it("est vide au départ : rien à annuler ni à refaire", () => {
    expect(annuler(HISTORIQUE_VIDE)).toBeNull();
    expect(refaire(HISTORIQUE_VIDE)).toBeNull();
  });

  it("annule le dernier geste en rendant l'état d'avant", () => {
    const h = enregistrer(
      enregistrer(HISTORIQUE_VIDE, entree(null, "a")),
      entree("a", "b"),
    );
    const resultat = annuler(h);
    expect(resultat?.cible.photo_id).toBe("a");
    expect(resultat?.historique.passe).toHaveLength(1);
    expect(resultat?.historique.futur).toHaveLength(1);
  });

  it("refait un geste annulé en rendant l'état d'après", () => {
    const h = enregistrer(HISTORIQUE_VIDE, entree(null, "a"));
    const annule = annuler(h);
    const refait = annule && refaire(annule.historique);
    expect(refait?.cible.photo_id).toBe("a");
    expect(refait?.historique.passe).toHaveLength(1);
    expect(refait?.historique.futur).toHaveLength(0);
  });

  it("un nouveau geste après une annulation efface ce qu'on pouvait refaire", () => {
    const annule = annuler(enregistrer(HISTORIQUE_VIDE, entree(null, "a")));
    const h = enregistrer(
      annule?.historique ?? HISTORIQUE_VIDE,
      entree(null, "c"),
    );
    expect(refaire(h)).toBeNull();
  });

  it("garde au plus PROFONDEUR_MAX gestes, les plus récents", () => {
    let h = HISTORIQUE_VIDE;
    for (let i = 0; i < PROFONDEUR_MAX + 5; i++) {
      h = enregistrer(h, entree(String(i), String(i + 1)));
    }
    expect(h.passe).toHaveLength(PROFONDEUR_MAX);
    expect(annuler(h)?.cible.photo_id).toBe(String(PROFONDEUR_MAX + 4));
  });
});
