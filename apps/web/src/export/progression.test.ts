import { describe, expect, it } from "vitest";
import { progressionExport } from "./progression";

describe("progressionExport", () => {
  it("démarre à zéro, avant la première étape", () => {
    expect(progressionExport(null)).toBe(0);
  });

  it("suit les photos téléchargées sur les trois quarts de la barre", () => {
    expect(
      progressionExport({ nom: "telechargement", faits: 0, total: 40 }),
    ).toBe(0);
    expect(
      progressionExport({ nom: "telechargement", faits: 20, total: 40 }),
    ).toBe(38);
    expect(
      progressionExport({ nom: "telechargement", faits: 40, total: 40 }),
    ).toBe(75);
  });

  it("ne divise pas par zéro quand le livre n'a aucune photo", () => {
    expect(
      progressionExport({ nom: "telechargement", faits: 0, total: 0 }),
    ).toBe(0);
  });

  it("avance à la composition puis à l'enregistrement", () => {
    expect(progressionExport({ nom: "composition" })).toBe(85);
    expect(progressionExport({ nom: "enregistrement" })).toBe(95);
  });
});
