import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DoublePageDuLivre } from "../api/doublesPages";
import { DoublePage, libelleDoublePage } from "./DoublePage";

type Emplacement = DoublePageDuLivre["emplacement"][number];

function emplacement(autres: Partial<Emplacement>): Emplacement {
  return {
    id: crypto.randomUUID(),
    indice: 0,
    nature: "photo",
    x: 20,
    y: 30,
    largeur: 100,
    hauteur: 50,
    photo_id: null,
    cadrage_x: null,
    cadrage_y: null,
    cadrage_zoom: null,
    contenu_texte: null,
    ...autres,
  };
}

function rendre(
  emplacements: Emplacement[],
  photos = new Map<
    string,
    { url?: string; largeur_px: number; hauteur_px: number }
  >(),
) {
  const doublePage: DoublePageDuLivre = {
    id: "d1",
    role: "interieur",
    position: 3,
    emplacement: emplacements,
  };
  return renderToStaticMarkup(
    <DoublePage doublePage={doublePage} fond="#FAF7F2" photos={photos} />,
  );
}

describe("libelleDoublePage", () => {
  it("nomme la couverture et la 4e", () => {
    expect(libelleDoublePage("couverture", null)).toBe("Couverture");
    expect(libelleDoublePage("quatrieme", null)).toBe(
      "Quatrième de couverture",
    );
  });

  it("donne les pages 2n et 2n + 1 de l'intérieure n", () => {
    expect(libelleDoublePage("interieur", 1)).toBe("Pages 2 et 3");
    expect(libelleDoublePage("interieur", 3)).toBe("Pages 6 et 7");
  });
});

describe("DoublePage", () => {
  it("peint le fond du thème et nomme la double page", () => {
    const html = rendre([]);
    expect(html).toContain('viewBox="0 0 420 210"');
    expect(html).toContain('aria-label="Pages 6 et 7"');
    expect(html).toContain('fill="#FAF7F2"');
  });

  it("montre la zone visible de la photo posée, dans le repère de l'original", () => {
    const html = rendre(
      [
        emplacement({
          photo_id: "p1",
          cadrage_x: 0.5,
          cadrage_y: 0.5,
          cadrage_zoom: 1,
        }),
      ],
      new Map([
        ["p1", { url: "https://x/v.webp", largeur_px: 1000, hauteur_px: 1000 }],
      ]),
    );
    expect(html).toContain('x="20" y="30" width="100" height="50"');
    expect(html).toContain('viewBox="0 250 1000 500"');
    expect(html).toContain(
      'href="https://x/v.webp" width="1000" height="1000"',
    );
  });

  it("prolonge du fond perdu une photo qui touche le bord", () => {
    const html = rendre(
      [
        emplacement({
          x: 0,
          y: 0,
          largeur: 420,
          hauteur: 210,
          photo_id: "p1",
          cadrage_x: 0.5,
          cadrage_y: 0.5,
          cadrage_zoom: 1,
        }),
      ],
      new Map([
        ["p1", { url: "https://x/v.webp", largeur_px: 426, hauteur_px: 216 }],
      ]),
    );
    expect(html).toContain('x="-3" y="-3" width="426" height="216"');
  });

  it("dessine un cadre vide quand aucune photo n'est posée", () => {
    const html = rendre([emplacement({})]);
    expect(html).not.toContain("<image");
    expect(html).toMatch(/<rect[^>]*x="20" y="30" width="100" height="50"/);
  });

  it("dessine un cadre vide quand la vignette manque", () => {
    const html = rendre(
      [
        emplacement({
          photo_id: "p1",
          cadrage_x: 0.5,
          cadrage_y: 0.5,
          cadrage_zoom: 1,
        }),
      ],
      new Map([["p1", { largeur_px: 1000, hauteur_px: 1000 }]]),
    );
    expect(html).not.toContain("<image");
  });
});
