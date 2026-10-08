import { describe, expect, it } from "vitest";
import { disposerTexte } from "./mise-en-lignes";
import { clePolice, FICHIERS_POLICES, type ClePolice } from "./polices";
import { mesuresReelles } from "./polices-de-test";
import { documentDepuisTexte } from "./texte-riche";
import type { Theme, Typographie } from "./typographie";

const MODERNE: Typographie = {
  titre: { police: "Nunito", graisse: 800, italique: false, taille_pt: 18 },
  legende: { police: "Nunito", graisse: 400, italique: false, taille_pt: 9 },
  alignement: "gauche",
  ancrage: "haut",
  styles_masques: [],
};

const CARNET: Typographie = {
  titre: { police: "Nunito", graisse: 700, italique: false, taille_pt: 15 },
  legende: { police: "Caveat", graisse: 600, italique: false, taille_pt: 15 },
  alignement: "exterieur",
  ancrage: "bas",
  styles_masques: [],
};

const enTheme = (typographie: Typographie): Theme => ({
  palette: { fond: "#ffffff", texte: "#000000" },
  bordure_cadre: null,
  typographie,
});

describe("clePolice", () => {
  it("trouve le fichier d'une police du catalogue", () => {
    expect(
      clePolice({ police: "EB Garamond", graisse: 400, italique: true }),
    ).toBe("eb-garamond-400-italique");
    expect(clePolice({ police: "Caveat", graisse: 600, italique: false })).toBe(
      "caveat-600",
    );
  });

  it("ne trouve rien pour une graisse absente", () => {
    expect(
      clePolice({ police: "Caveat", graisse: 400, italique: false }),
    ).toBeNull();
  });
});

describe("les fichiers de police", () => {
  it.each(Object.keys(FICHIERS_POLICES) as ClePolice[])(
    "%s se lit et se mesure",
    (cle) => {
      const mesure = mesuresReelles(cle);
      expect(mesure.largeur("Été à Lisbonne", 5)).toBeGreaterThan(10);
      expect(mesure.ascendant).toBeGreaterThan(0.5);
      expect(mesure.descendant).toBeGreaterThan(0);
    },
  );

  it("une légende qui tient en Moderne déborde en Carnet", () => {
    // Légende du gabarit 11, 79 × 14 mm.
    const legende = {
      x: 225,
      y: 162,
      largeur: 79,
      hauteur: 14,
      style_texte: "legende" as const,
      contenu_texte: documentDepuisTexte(
        "Le phare de Kermorvan au petit matin, avant la marée haute de septembre. Les mouettes tournent au-dessus du port.",
      ),
    };
    expect(
      disposerTexte(legende, enTheme(MODERNE), mesuresReelles).deborde,
    ).toBe(false);
    expect(
      disposerTexte(legende, enTheme(CARNET), mesuresReelles).deborde,
    ).toBe(true);
  });
});
