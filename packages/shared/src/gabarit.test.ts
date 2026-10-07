import { describe, expect, it } from "vitest";
import { definitionGabaritSchema } from "./gabarit";

const cadre = {
  indice: 0,
  x: 0,
  y: 0,
  largeur: 100,
  hauteur: 100,
  nature: "photo",
};

describe("definitionGabaritSchema", () => {
  it("accepte une liste de cadres d'indices distincts", () => {
    expect(
      definitionGabaritSchema.parse([
        cadre,
        { ...cadre, indice: 1, nature: "texte", style: "legende" },
      ]),
    ).toHaveLength(2);
  });

  it("refuse un gabarit sans cadre", () => {
    expect(definitionGabaritSchema.safeParse([]).success).toBe(false);
  });

  it("refuse deux cadres de même indice", () => {
    expect(definitionGabaritSchema.safeParse([cadre, cadre]).success).toBe(
      false,
    );
  });

  it("refuse un cadre de largeur nulle", () => {
    expect(
      definitionGabaritSchema.safeParse([{ ...cadre, largeur: 0 }]).success,
    ).toBe(false);
  });

  it("refuse un cadre texte sans style", () => {
    expect(
      definitionGabaritSchema.safeParse([{ ...cadre, nature: "texte" }])
        .success,
    ).toBe(false);
  });

  it("refuse un cadre photo avec un style", () => {
    expect(
      definitionGabaritSchema.safeParse([{ ...cadre, style: "titre" }]).success,
    ).toBe(false);
  });

  it("refuse un style inconnu", () => {
    expect(
      definitionGabaritSchema.safeParse([
        { ...cadre, nature: "texte", style: "paragraphe" },
      ]).success,
    ).toBe(false);
  });
});
