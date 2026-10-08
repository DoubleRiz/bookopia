import { describe, expect, it } from "vitest";
import { accepte, type Evaluation } from "./extensionsTexte";

const tient: Evaluation = { deborde: false, hauteur: 12, longueur: 40 };

describe("accepte", () => {
  it("accepte un texte qui tient", () => {
    expect(accepte(tient, { deborde: false, hauteur: 18, longueur: 60 })).toBe(
      true,
    );
  });

  it("refuse une frappe qui fait déborder le cadre", () => {
    expect(accepte(tient, { deborde: true, hauteur: 30, longueur: 41 })).toBe(
      false,
    );
  });

  it("laisse raccourcir un texte déjà trop long", () => {
    const trop: Evaluation = { deborde: true, hauteur: 30, longueur: 80 };
    expect(accepte(trop, { deborde: true, hauteur: 24, longueur: 70 })).toBe(
      true,
    );
    expect(accepte(trop, { deborde: true, hauteur: 36, longueur: 90 })).toBe(
      false,
    );
  });

  it("refuse de dépasser 400 caractères, mais laisse raccourcir au-delà", () => {
    const plein: Evaluation = { deborde: false, hauteur: 12, longueur: 400 };
    expect(accepte(plein, { ...plein, longueur: 401 })).toBe(false);
    const trop: Evaluation = { deborde: false, hauteur: 12, longueur: 450 };
    expect(accepte(trop, { ...trop, longueur: 440 })).toBe(true);
  });
});
