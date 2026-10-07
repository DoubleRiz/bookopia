import { describe, expect, it } from "vitest";
import { pixelsPour300Dpi, tailleOriginal } from "./taille-original";

const cadre = (largeur: number, hauteur: number) => ({ largeur, hauteur });

describe("pixelsPour300Dpi", () => {
  it("compte le fond perdu de 3 mm de chaque côté", () => {
    // 210 + 6 = 216 mm, soit 2551,18 px à 300 DPI.
    expect(pixelsPour300Dpi(210)).toBe(2552);
  });
});

describe("tailleOriginal", () => {
  it("réduit une photo trop grande au plus grand cadre", () => {
    // Cadre de 420 × 210 mm : 5032 × 2552 px. Photo 3:2, la largeur commande.
    expect(tailleOriginal(10000, 6000, [cadre(420, 210)])).toEqual({
      largeur: 5032,
      hauteur: 3019,
    });
  });

  it("n'agrandit jamais une photo plus petite que le cadre", () => {
    expect(tailleOriginal(3000, 2000, [cadre(420, 210)])).toEqual({
      largeur: 3000,
      hauteur: 2000,
    });
  });

  it("retient le cadre le plus exigeant pour la photo", () => {
    // Une photo portrait dans un cadre presque carré : c'est la largeur qui commande.
    const cadres = [cadre(420, 140), cadre(200, 210)];
    // 420 × 140 : max(5032 / 4000, …) → aucune réduction possible.
    expect(tailleOriginal(4000, 6000, cadres)).toEqual({
      largeur: 4000,
      hauteur: 6000,
    });
    // 200 × 210 seul : max(2434 / 4000, 2552 / 6000) = 0,6085.
    expect(tailleOriginal(4000, 6000, [cadre(200, 210)])).toEqual({
      largeur: 2434,
      hauteur: 3651,
    });
  });

  it("garde la photo entière sans cadre", () => {
    expect(tailleOriginal(4000, 3000, [])).toEqual({
      largeur: 4000,
      hauteur: 3000,
    });
  });
});
