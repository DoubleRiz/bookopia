import { describe, expect, it } from "vitest";
import {
  type Cadre,
  chevauche,
  chevaucheUnAutre,
  glisser,
  memeCadre,
  pousser,
} from "./geometrieCadre";

const cadre: Cadre = { x: 40, y: 100, largeur: 60, hauteur: 20 };

describe("glisser", () => {
  it("déplace sur la grille de 2 mm", () => {
    expect(glisser(cadre, "corps", 10.7, 3.2, [])).toEqual({
      ...cadre,
      x: 50,
      y: 104,
    });
  });

  it("s'arrête aux marges de sécurité", () => {
    expect(glisser(cadre, "corps", -100, -200, [])).toMatchObject({
      x: 12,
      y: 12,
    });
    expect(glisser(cadre, "corps", 900, 900, [])).toMatchObject({
      x: 408 - 60,
      y: 198 - 20,
    });
  });

  it("se colle au bord d'un autre cadre", () => {
    const autre: Cadre = { x: 200, y: 20, largeur: 50, hauteur: 30 };
    // Le bord droit (40 + 60 + 99,6 = 199,6) se colle au bord gauche de l'autre cadre.
    expect(glisser(cadre, "corps", 99.6, 0, [autre])).toMatchObject({
      x: 140,
    });
  });

  it("redimensionne par une poignée, sans passer sous la taille minimale", () => {
    expect(glisser(cadre, "e", 20, 0, [])).toMatchObject({ largeur: 80 });
    expect(glisser(cadre, "e", -100, 0, [])).toMatchObject({ largeur: 20 });
    expect(glisser(cadre, "s", 0, -100, [])).toMatchObject({ hauteur: 6 });
  });

  it("redimensionne par le coin nord-ouest en gardant le coin opposé", () => {
    expect(glisser(cadre, "nw", -10, -10, [])).toEqual({
      x: 30,
      y: 90,
      largeur: 70,
      hauteur: 30,
    });
  });
});

describe("chevauchement", () => {
  const autre: Cadre = { x: 100, y: 100, largeur: 30, hauteur: 20 };

  it("des bords qui se touchent ne se chevauchent pas", () => {
    expect(chevauche(cadre, autre)).toBe(false);
  });

  it("un recouvrement sur les deux axes se chevauche", () => {
    expect(chevaucheUnAutre({ ...cadre, x: 50 }, [autre])).toBe(true);
    expect(chevaucheUnAutre({ ...cadre, y: 130 }, [autre])).toBe(false);
  });
});

describe("pousser", () => {
  it("déplace d'un pas de grille", () => {
    expect(pousser(cadre, "ArrowRight", false)).toMatchObject({ x: 42 });
    expect(pousser(cadre, "ArrowUp", false)).toMatchObject({ y: 98 });
  });

  it("change la taille avec Maj", () => {
    expect(pousser(cadre, "ArrowRight", true)).toMatchObject({ largeur: 62 });
    expect(pousser(cadre, "ArrowDown", true)).toMatchObject({ hauteur: 22 });
  });

  it("reste dans les marges et au-dessus du minimum", () => {
    expect(pousser({ ...cadre, x: 12 }, "ArrowLeft", false).x).toBe(12);
    expect(pousser({ ...cadre, largeur: 20 }, "ArrowLeft", true).largeur).toBe(
      20,
    );
  });
});

describe("memeCadre", () => {
  it("compare les quatre valeurs", () => {
    expect(memeCadre(cadre, { ...cadre })).toBe(true);
    expect(memeCadre(cadre, { ...cadre, y: 101 })).toBe(false);
  });
});
