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
        { ...cadre, indice: 1, nature: "texte" },
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
});
