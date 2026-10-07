import type { DefinitionGabarit, GabaritAComposer } from "@bookopia/shared";
import { describe, expect, it } from "vitest";
import { gabaritParDefaut } from "./gabaritParDefaut";

const cadre = (indice: number, nature: "photo" | "texte") => ({
  indice,
  nature,
  x: 0,
  y: 0,
  largeur: 10,
  hauteur: 10,
});

const gabarit = (
  id: string,
  natures: ("photo" | "texte")[],
): GabaritAComposer => ({
  id,
  nom: id,
  definition: natures.map((nature, indice) =>
    cadre(indice, nature),
  ) as DefinitionGabarit,
});

describe("gabaritParDefaut", () => {
  it("prend le gabarit qui a le moins de cadres photo", () => {
    const choisi = gabaritParDefaut([
      gabarit("b4", ["photo", "photo"]),
      gabarit("b5", ["photo", "photo", "photo"]),
    ]);
    expect(choisi?.id).toBe("b4");
  });

  it("ne compte pas les cadres texte", () => {
    const choisi = gabaritParDefaut([
      gabarit("b11", ["photo", "photo", "photo", "texte"]),
      gabarit("b8", ["photo", "texte", "texte"]),
    ]);
    expect(choisi?.id).toBe("b8");
  });

  it("départage par l'ordre du catalogue", () => {
    const choisi = gabaritParDefaut([
      gabarit("b2", ["photo"]),
      gabarit("b1", ["photo"]),
    ]);
    expect(choisi?.id).toBe("b1");
  });

  it("ne choisit rien dans un catalogue vide", () => {
    expect(gabaritParDefaut([])).toBeNull();
  });
});
