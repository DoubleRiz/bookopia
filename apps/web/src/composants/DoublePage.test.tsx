import {
  documentDepuisTexte,
  type MesureTexte,
  type Theme,
} from "@bookopia/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DoublePageDuLivre } from "../api/doublesPages";
import {
  DoublePage,
  type Habillage,
  type InteractionDoublePage,
  libelleDoublePage,
} from "./DoublePage";

// Chasse fixe : chaque caractère fait la moitié de la taille.
const chasseFixe: MesureTexte = {
  largeur: (texte, taille_mm) => texte.length * taille_mm * 0.5,
  ascendant: 0.8,
  descendant: 0.2,
};

const MODERNE: Theme = {
  palette: { fond: "#FAF7F2", texte: "#1E1B2E" },
  bordure_cadre: null,
  typographie: {
    titre: { police: "Nunito", graisse: 800, italique: false, taille_pt: 18 },
    legende: { police: "Nunito", graisse: 400, italique: false, taille_pt: 9 },
    alignement: "gauche",
    ancrage: "haut",
    styles_masques: [],
  },
};

const HABILLAGE: Habillage = { theme: MODERNE, mesures: () => chasseFixe };

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
    style_texte: null,
    ...autres,
  };
}

function rendre(
  emplacements: Emplacement[],
  photos = new Map<
    string,
    { url?: string; largeur_px: number; hauteur_px: number }
  >(),
  interaction?: InteractionDoublePage,
  habillage: Habillage = HABILLAGE,
) {
  const doublePage: DoublePageDuLivre = {
    id: "d1",
    role: "interieur",
    position: 3,
    gabarit_origine_id: null,
    emplacement: emplacements,
  };
  return renderToStaticMarkup(
    <DoublePage
      doublePage={doublePage}
      habillage={habillage}
      photos={photos}
      interaction={interaction}
    />,
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

  it("dessine les lignes d'un texte avec la police et la couleur du thème", () => {
    const html = rendre([
      emplacement({
        nature: "texte",
        style_texte: "titre",
        contenu_texte: documentDepuisTexte("Lisbonne"),
      }),
    ]);
    expect(html).toContain('font-family="bookopia-nunito-800"');
    expect(html).toContain('fill="#1E1B2E"');
    expect(html).toContain(">Lisbonne</text>");
    expect(html).not.toContain("Écrire");
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

describe("DoublePage dans l'éditeur", () => {
  const rien = () => {};
  const interaction = (selection: string | null): InteractionDoublePage => ({
    selection,
    enSaisie: null,
    surSelection: rien,
    surSaisir: rien,
    surDepot: rien,
    surPlacer: rien,
    surRecadrer: rien,
    surVider: rien,
  });
  const posee = (id: string) =>
    emplacement({
      id,
      photo_id: "p1",
      cadrage_x: 0.5,
      cadrage_y: 0.5,
      cadrage_zoom: 1,
    });

  it("rend les cadres photo focalisables et nommés", () => {
    const html = rendre(
      [emplacement({ id: "e1" })],
      undefined,
      interaction(null),
    );
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Cadre 1, vide"');
    expect(html).toContain('aria-pressed="false"');
  });

  it("marque le cadre sélectionné", () => {
    const html = rendre(
      [emplacement({ id: "e1" })],
      undefined,
      interaction("e1"),
    );
    expect(html).toContain('aria-pressed="true"');
  });

  const texte = (contenu_texte: string | null) =>
    emplacement({
      id: "t1",
      nature: "texte",
      style_texte: "legende",
      contenu_texte: documentDepuisTexte(contenu_texte ?? ""),
    });

  it("rend un cadre texte focalisable et nommé selon son style", () => {
    const html = rendre([texte(null)], undefined, interaction(null));
    expect(html).toContain('aria-label="Légende 1, vide"');
    expect(html).toContain("Écrire une légende");
  });

  it("ne rend pas un cadre texte focalisable tant que les polices manquent", () => {
    const html = rendre([texte("Lisbonne")], undefined, interaction(null), {
      theme: MODERNE,
      mesures: null,
    });
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("Lisbonne");
  });

  it("dit qu'un cadre est masqué par le thème, sans le rendre modifiable", () => {
    const silence: Theme = {
      ...MODERNE,
      typographie: { ...MODERNE.typographie, styles_masques: ["legende"] },
    };
    const html = rendre([texte("Lisbonne")], undefined, interaction(null), {
      theme: silence,
      mesures: () => chasseFixe,
    });
    expect(html).toContain("Masqué par le thème");
    expect(html).not.toContain("Lisbonne");
    expect(html).not.toContain("tabindex");
  });

  it("avertit d'un texte que le PDF coupera", () => {
    // Cadre de 100 × 50 mm, 9 pt : 63 caractères par ligne, 13 lignes au plus.
    const html = rendre(
      [texte("Une longue légende. ".repeat(60))],
      undefined,
      interaction(null),
    );
    expect(html).toContain("Texte coupé à l&#x27;impression");
  });

  it("ne dessine pas les lignes du cadre en cours de saisie", () => {
    const html = rendre([texte("Lisbonne")], undefined, {
      ...interaction("t1"),
      enSaisie: "t1",
    });
    expect(html).not.toContain("Lisbonne");
    expect(html).not.toContain('aria-label="Légende 1');
  });

  it("avertit d'une qualité insuffisante pour l'impression", () => {
    // 100 mm de large, 400 px visibles : environ 100 DPI.
    const html = rendre(
      [posee("e1")],
      new Map([["p1", { url: "u", largeur_px: 400, hauteur_px: 200 }]]),
      interaction(null),
    );
    expect(html).toContain("Qualité insuffisante");
  });

  it("n'avertit de rien à 300 DPI ou plus", () => {
    const html = rendre(
      [posee("e1")],
      new Map([["p1", { url: "u", largeur_px: 4000, hauteur_px: 2000 }]]),
      interaction(null),
    );
    expect(html).not.toContain("Qualité");
  });

  it("reste un simple dessin sans interaction", () => {
    const html = rendre(
      [posee("e1")],
      new Map([["p1", { url: "u", largeur_px: 400, hauteur_px: 200 }]]),
    );
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("Qualité");
  });
});
