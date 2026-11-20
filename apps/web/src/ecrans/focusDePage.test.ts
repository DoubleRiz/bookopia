import type { UIMatch } from "react-router";
import { describe, expect, it } from "vitest";
import { adresseDeEcran } from "./focusDePage";

const etape = (pathname: string, handle?: unknown) =>
  ({ pathname, handle }) as UIMatch;

describe("adresseDeEcran", () => {
  it("prend l'adresse de la dernière route de l'écran", () => {
    expect(
      adresseDeEcran([etape("/"), etape("/connexion", { titre: "Connexion" })]),
    ).toBe("/connexion");
  });

  it("ignore une surcouche : l'écran dessous n'a pas changé", () => {
    const livres = etape("/livres", { titre: "Mes livres" });
    const nouveau = etape("/livres/nouveau", { surcouche: true });
    expect(adresseDeEcran([etape("/"), livres, nouveau])).toBe(
      adresseDeEcran([etape("/"), livres]),
    );
  });

  it("distingue deux écrans sous le même livre", () => {
    const livre = (suite: string) =>
      adresseDeEcran([etape(`/livre/1${suite}`)]);
    expect(livre("")).not.toBe(livre("/export"));
  });

  it("rend une chaîne vide sans route", () => {
    expect(adresseDeEcran([])).toBe("");
  });
});
