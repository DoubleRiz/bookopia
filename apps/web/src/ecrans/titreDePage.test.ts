import type { UIMatch } from "react-router";
import { describe, expect, it } from "vitest";
import { composerTitre } from "./titreDePage";

function etape(handle: unknown, loaderData?: unknown): UIMatch {
  return { id: "", pathname: "", params: {}, loaderData, handle };
}

describe("composerTitre", () => {
  it("suit le titre de l'écran de « Bookopia »", () => {
    expect(composerTitre([etape({ titre: "Mes livres" })])).toBe(
      "Mes livres · Bookopia",
    );
  });

  it("va de l'écran le plus précis au plus général", () => {
    const titre = composerTitre([
      etape(undefined),
      etape({ titre: "Mes livres" }),
      etape({ titre: "Nouveau livre" }),
    ]);
    expect(titre).toBe("Nouveau livre · Mes livres · Bookopia");
  });

  it("reprend le nom du livre lu par le loader", () => {
    const livre = etape(
      { titre: (d?: { projet: { titre: string } }) => d?.projet.titre },
      { projet: { titre: "Bretagne" } },
    );
    expect(
      composerTitre([livre, etape({ titre: "Importer des photos" })]),
    ).toBe("Importer des photos · Bretagne · Bookopia");
  });

  it("saute un titre que le loader n'a pas pu fournir", () => {
    const livre = etape({
      titre: (d?: { projet: { titre: string } }) => d?.projet.titre,
    });
    expect(composerTitre([livre])).toBe("Bookopia");
  });
});
