import { describe, expect, it } from "vitest";
import {
  controlerExport,
  type DoublePageAControler,
  type EmplacementAControler,
} from "./controle-export";

function emplacement(
  autres: Partial<EmplacementAControler>,
): EmplacementAControler {
  return {
    id: "e",
    nature: "photo",
    x: 20,
    y: 20,
    largeur: 100,
    hauteur: 50,
    cadrage_x: 0.5,
    cadrage_y: 0.5,
    cadrage_zoom: 1,
    photo: { largeur_px: 1200, hauteur_px: 800 },
    ...autres,
  };
}

function doublePage(
  id: string,
  emplacements: EmplacementAControler[],
): DoublePageAControler {
  return { id, emplacements };
}

describe("controlerExport", () => {
  it("ne signale rien quand tous les cadres sont à 300 DPI ou plus", () => {
    // 1200 px sur 100 mm : 304,8 DPI.
    expect(
      controlerExport([doublePage("d1", [emplacement({ id: "e1" })])]),
    ).toEqual({ faibles: [], vides: [] });
  });

  it("liste un cadre photo sous 150 DPI avec son DPI non arrondi", () => {
    // 400 px sur 100 mm : 101,6 DPI.
    const { faibles, vides } = controlerExport([
      doublePage("d1", [
        emplacement({ id: "e1", photo: { largeur_px: 400, hauteur_px: 300 } }),
      ]),
    ]);
    expect(vides).toEqual([]);
    expect(faibles).toHaveLength(1);
    expect(faibles[0]).toMatchObject({
      double_page_id: "d1",
      emplacement_id: "e1",
    });
    expect(faibles[0]?.dpi).toBeCloseTo(101.6, 1);
  });

  it("ne liste pas un cadre entre 150 et 300 DPI", () => {
    // 600 px sur 100 mm : 152,4 DPI, avertissement doux de l'éditeur seulement.
    expect(
      controlerExport([
        doublePage("d1", [
          emplacement({ photo: { largeur_px: 600, hauteur_px: 400 } }),
        ]),
      ]).faibles,
    ).toEqual([]);
  });

  it("compte le zoom : un bon cadre zoomé peut passer sous 150 DPI", () => {
    // 1200 px, zoom 3 : 400 px visibles sur 100 mm.
    const { faibles } = controlerExport([
      doublePage("d1", [emplacement({ id: "e1", cadrage_zoom: 3 })]),
    ]);
    expect(faibles.map((f) => f.emplacement_id)).toEqual(["e1"]);
  });

  it("compte le fond perdu d'un cadre au bord de la double page", () => {
    // 600 px sur 100 mm : 152,4 DPI dans la zone utile, 148 DPI avec 3 mm de fond perdu.
    const { faibles } = controlerExport([
      doublePage("d1", [
        emplacement({
          id: "e1",
          x: 0,
          y: 0,
          photo: { largeur_px: 600, hauteur_px: 400 },
        }),
      ]),
    ]);
    expect(faibles).toHaveLength(1);
    expect(faibles[0]?.dpi).toBeCloseTo(147.96, 1);
  });

  it("liste un cadre photo sans photo comme vide", () => {
    expect(
      controlerExport([
        doublePage("d1", [emplacement({ id: "e1", photo: null })]),
      ]),
    ).toEqual({
      faibles: [],
      vides: [{ double_page_id: "d1", emplacement_id: "e1" }],
    });
  });

  it("ne liste jamais un cadre texte, vide ou non", () => {
    expect(
      controlerExport([
        doublePage("d1", [
          emplacement({ id: "t", nature: "texte", photo: null }),
        ]),
      ]),
    ).toEqual({ faibles: [], vides: [] });
  });

  it("prend le cadrage neutre quand une photo posée n'en a pas", () => {
    const { faibles, vides } = controlerExport([
      doublePage("d1", [
        emplacement({
          id: "e1",
          cadrage_x: null,
          cadrage_y: null,
          cadrage_zoom: null,
          photo: { largeur_px: 400, hauteur_px: 300 },
        }),
      ]),
    ]);
    expect(vides).toEqual([]);
    expect(faibles[0]?.dpi).toBeCloseTo(101.6, 1);
  });

  it("accepte une double page sans emplacement", () => {
    expect(controlerExport([doublePage("d1", [])])).toEqual({
      faibles: [],
      vides: [],
    });
  });

  it("garde l'ordre du livre : doubles pages, puis emplacements", () => {
    const pauvre = { largeur_px: 400, hauteur_px: 300 };
    const { faibles, vides } = controlerExport([
      doublePage("d1", [
        emplacement({ id: "a", photo: pauvre }),
        emplacement({ id: "b", photo: null }),
      ]),
      doublePage("d2", [
        emplacement({ id: "c", photo: null }),
        emplacement({ id: "d", photo: pauvre }),
      ]),
    ]);
    expect(faibles.map((f) => f.emplacement_id)).toEqual(["a", "d"]);
    expect(vides.map((v) => v.emplacement_id)).toEqual(["b", "c"]);
  });
});
