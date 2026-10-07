import { describe, expect, it } from "vitest";
import {
  dpiEffectif,
  niveauResolution,
  placerPhoto,
  prolongerParFondPerdu,
  zoneVisible,
} from "./cadrage";

const image = (largeur_px: number, hauteur_px: number) => ({
  largeur_px,
  hauteur_px,
});
const cadrage = (x: number, y: number, zoom: number) => ({ x, y, zoom });

describe("prolongerParFondPerdu", () => {
  it("prolonge de 3 mm chaque bord qui touche la double page", () => {
    expect(
      prolongerParFondPerdu({ x: 0, y: 0, largeur: 200, hauteur: 210 }),
    ).toEqual({ x: -3, y: -3, largeur: 203, hauteur: 216 });
  });

  it("prolonge une pleine double page sur ses quatre bords", () => {
    expect(
      prolongerParFondPerdu({ x: 0, y: 0, largeur: 420, hauteur: 210 }),
    ).toEqual({ x: -3, y: -3, largeur: 426, hauteur: 216 });
  });

  it("prolonge le bord droit d'un cadre de la page droite", () => {
    expect(
      prolongerParFondPerdu({ x: 220, y: 0, largeur: 200, hauteur: 210 }),
    ).toEqual({ x: 220, y: -3, largeur: 203, hauteur: 216 });
  });

  it("ne touche pas un cadre dans la zone utile", () => {
    const cadre = { x: 12, y: 34.5, largeur: 188, hauteur: 141 };
    expect(prolongerParFondPerdu(cadre)).toEqual(cadre);
  });
});

describe("zoneVisible", () => {
  it("prend toute la hauteur d'une image plus large que le cadre", () => {
    expect(
      zoneVisible(
        image(4000, 2000),
        { largeur: 100, hauteur: 100 },
        cadrage(0.5, 0.5, 1),
      ),
    ).toEqual({ x: 1000, y: 0, largeur: 2000, hauteur: 2000 });
  });

  it("prend toute la largeur d'une image plus haute que le cadre", () => {
    expect(
      zoneVisible(
        image(1000, 3000),
        { largeur: 200, hauteur: 100 },
        cadrage(0.5, 0.5, 1),
      ),
    ).toEqual({ x: 0, y: 1250, largeur: 1000, hauteur: 500 });
  });

  it("divise la zone par le zoom, autour du centre", () => {
    expect(
      zoneVisible(
        image(4000, 2000),
        { largeur: 100, hauteur: 100 },
        cadrage(0.5, 0.5, 2),
      ),
    ).toEqual({ x: 1500, y: 500, largeur: 1000, hauteur: 1000 });
  });

  it("place le centre où le demande le cadrage", () => {
    expect(
      zoneVisible(
        image(4000, 2000),
        { largeur: 100, hauteur: 100 },
        cadrage(0.25, 0.75, 2),
      ),
    ).toEqual({ x: 500, y: 1000, largeur: 1000, hauteur: 1000 });
  });

  it("ramène dans l'image une zone qui en sortirait", () => {
    expect(
      zoneVisible(
        image(4000, 2000),
        { largeur: 100, hauteur: 100 },
        cadrage(1, 0, 2),
      ),
    ).toEqual({ x: 3000, y: 0, largeur: 1000, hauteur: 1000 });
  });
});

describe("placerPhoto", () => {
  const neutre = { cadrage_x: 0.5, cadrage_y: 0.5, cadrage_zoom: 1 };

  it("remplit le cadre prolongé quand il touche le bord", () => {
    expect(
      placerPhoto(
        { x: 0, y: 0, largeur: 210, hauteur: 210, ...neutre },
        image(2160, 2160),
      ),
    ).toEqual({
      cadre: { x: -3, y: -3, largeur: 213, hauteur: 216 },
      zone: { x: 1080 - 1065, y: 0, largeur: 2130, hauteur: 2160 },
    });
  });

  it("garde le cadre tel quel à l'intérieur de la double page", () => {
    expect(
      placerPhoto(
        { x: 20, y: 30, largeur: 100, hauteur: 50, ...neutre },
        image(1000, 1000),
      ),
    ).toEqual({
      cadre: { x: 20, y: 30, largeur: 100, hauteur: 50 },
      zone: { x: 0, y: 250, largeur: 1000, hauteur: 500 },
    });
  });
});

describe("dpiEffectif", () => {
  // Cadre 4:3 dans la zone utile : à zoom 1, toute la largeur de l'image est visible.
  const cadre = { x: 12, y: 34.5, largeur: 188, hauteur: 141 };
  const pose = (zoom: number) => ({
    ...cadre,
    cadrage_x: 0.5,
    cadrage_y: 0.5,
    cadrage_zoom: zoom,
  });

  it("rapporte la largeur visible en pixels à la largeur du cadre", () => {
    expect(dpiEffectif(pose(1), image(4000, 3000))).toBeCloseTo(
      (4000 / 188) * 25.4,
    );
  });

  it("baisse de moitié quand on zoome deux fois", () => {
    expect(dpiEffectif(pose(2), image(4000, 3000))).toBeCloseTo(
      (2000 / 188) * 25.4,
    );
  });

  it("est faible pour une petite photo dans un grand cadre", () => {
    expect(dpiEffectif(pose(1), image(1000, 750))).toBeLessThan(150);
  });

  it("compte le fond perdu d'un cadre à cheval sur le pli", () => {
    const pleine = {
      x: 0,
      y: 0,
      largeur: 420,
      hauteur: 210,
      cadrage_x: 0.5,
      cadrage_y: 0.5,
      cadrage_zoom: 1,
    };
    // Cadre imprimé : 426 × 216 mm. L'image 2:1 est plus large : sa hauteur est entière.
    const largeurVisible = 3000 * (426 / 216);
    expect(dpiEffectif(pleine, image(6000, 3000))).toBeCloseTo(
      (largeurVisible / 426) * 25.4,
    );
  });
});

describe("niveauResolution", () => {
  it("est bon à partir de 300 DPI", () => {
    expect(niveauResolution(300)).toBe("bon");
    expect(niveauResolution(540)).toBe("bon");
  });

  it("est moyen de 150 à 300 DPI", () => {
    expect(niveauResolution(150)).toBe("moyen");
    expect(niveauResolution(299.9)).toBe("moyen");
  });

  it("est faible sous 150 DPI", () => {
    expect(niveauResolution(149.9)).toBe("faible");
  });
});
