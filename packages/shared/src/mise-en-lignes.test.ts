import { describe, expect, it } from "vitest";
import {
  disposerTexte,
  type LigneDisposee,
  prefixeQuiTient,
  RETRAIT_PUCE_MM,
  type TexteAPlacer,
  tronquerPourTenir,
} from "./mise-en-lignes";
import type { MesureTexte } from "./polices";
import {
  type DocumentTexte,
  documentDepuisTexte,
  type SegmentTexte,
} from "./texte-riche";
import { MM_PAR_POINT, type Theme } from "./typographie";

// Chasse fixe : chaque caractère fait la moitié de la taille. Ascendant 0,8, descendant 0,2.
const chasseFixe: MesureTexte = {
  largeur: (texte, taille_mm) => texte.length * taille_mm * 0.5,
  ascendant: 0.8,
  descendant: 0.2,
};
const mesures = () => chasseFixe;

// Taille choisie pour qu'un caractère fasse 1 mm et une ligne 2 × 1,2 = 2,4 mm.
const TAILLE_PT = 2 / MM_PAR_POINT;

const theme: Theme = {
  palette: { fond: "#ffffff", texte: "#112233" },
  bordure_cadre: null,
  typographie: {
    titre: {
      police: "Nunito",
      graisse: 800,
      italique: false,
      taille_pt: TAILLE_PT,
    },
    legende: {
      police: "Nunito",
      graisse: 400,
      italique: false,
      taille_pt: TAILLE_PT,
    },
    alignement: "gauche",
    ancrage: "haut",
    styles_masques: [],
  },
};

const avecTypographie = (modif: Partial<Theme["typographie"]>): Theme => ({
  ...theme,
  typographie: { ...theme.typographie, ...modif },
});

const paragraphes = (...textes: string[]) =>
  documentDepuisTexte(textes.join("\n"));

const unParagraphe = (
  segments: SegmentTexte[],
  alignement?: "gauche" | "centre" | "droite",
): DocumentTexte => ({
  version: 1,
  blocs: [{ type: "paragraphe", alignement, segments }],
});

const cadre = (modif: Partial<TexteAPlacer> = {}): TexteAPlacer => ({
  x: 10,
  y: 20,
  largeur: 10,
  hauteur: 5,
  style_texte: "legende",
  contenu_texte: null,
  ...modif,
});

const texteDe = (ligne: LigneDisposee) =>
  ligne.fragments.map((fragment) => fragment.texte).join("");

function lignes(texte: string, largeur = 10) {
  return disposerTexte(
    cadre({
      largeur,
      hauteur: 1000,
      contenu_texte: documentDepuisTexte(texte),
    }),
    theme,
    mesures,
  ).lignes.map(texteDe);
}

describe("mise en lignes d'un texte simple", () => {
  it("ne produit aucune ligne pour un texte vide", () => {
    expect(lignes("")).toEqual([]);
  });

  it("coupe aux espaces, sans compter l'espace de fin", () => {
    expect(lignes("Le phare au matin")).toEqual(["Le phare", "au matin"]);
    expect(lignes("abcde fghij")).toEqual(["abcde", "fghij"]);
  });

  it("garde sur une ligne ce qui tient exactement", () => {
    expect(lignes("abcde fghi")).toEqual(["abcde fghi"]);
  });

  it("respecte les retours à la ligne du Créateur, lignes vides comprises", () => {
    expect(lignes("Été\n\nLisbonne")).toEqual(["Été", "", "Lisbonne"]);
  });

  it("coupe un mot plus large que le cadre, caractère par caractère", () => {
    expect(lignes("abcdefghijklmnopqrstuvwxy")).toEqual([
      "abcdefghij",
      "klmnopqrst",
      "uvwxy",
    ]);
  });

  it("reprend après un mot coupé", () => {
    expect(lignes("ab abcdefghijkl mn")).toEqual(["ab", "abcdefghij", "kl mn"]);
  });
});

describe("disposerTexte", () => {
  it("place la première ligne de base sous le haut du cadre, demi-interligne compris", () => {
    // Ligne de 2,4 mm, glyphes de 2 mm : 0,2 mm au-dessus, puis l'ascendant de 1,6 mm.
    const dispose = disposerTexte(
      cadre({ contenu_texte: paragraphes("Été") }),
      theme,
      mesures,
    );
    expect(dispose.lignes).toHaveLength(1);
    const [fragment] = dispose.lignes[0]?.fragments ?? [];
    expect(fragment?.x).toBe(10);
    expect(fragment?.y).toBeCloseTo(21.8);
    expect(fragment?.taille_mm).toBeCloseTo(2);
    expect(fragment?.police).toBe("nunito-400");
    expect(fragment?.couleur).toBe("#112233");
    expect(fragment?.souligne).toBe(false);
    expect(dispose.lignes[0]?.hauteur).toBeCloseTo(2.4);
    expect(dispose.deborde).toBe(false);
    expect(dispose.masque).toBe(false);
  });

  it("prend la police du titre pour un titre et pour le titre de la page de titre", () => {
    for (const style of ["titre", "titre_page"] as const) {
      const dispose = disposerTexte(
        cadre({ style_texte: style, contenu_texte: paragraphes("a") }),
        theme,
        mesures,
      );
      expect(dispose.lignes[0]?.fragments[0]?.police).toBe("nunito-800");
    }
  });

  it("centre sur le milieu du cadre", () => {
    const dispose = disposerTexte(
      cadre({ contenu_texte: paragraphes("abcd") }),
      avecTypographie({ alignement: "centre" }),
      mesures,
    );
    // Cadre de 10 mm, texte de 4 mm : il commence à 10 + 3.
    expect(dispose.lignes[0]?.fragments[0]?.x).toBe(13);
  });

  it("cale sur le bord extérieur : à gauche sur la page de gauche, à droite sur celle de droite", () => {
    const exterieur = avecTypographie({ alignement: "exterieur" });
    const gauche = disposerTexte(
      cadre({ contenu_texte: paragraphes("abcd") }),
      exterieur,
      mesures,
    );
    expect(gauche.lignes[0]?.fragments[0]?.x).toBe(10);
    const droite = disposerTexte(
      cadre({ x: 300, contenu_texte: paragraphes("abcd") }),
      exterieur,
      mesures,
    );
    expect(droite.lignes[0]?.fragments[0]?.x).toBe(306);
  });

  it("pose le bloc de lignes sur le bas du cadre en ancrage bas", () => {
    const dispose = disposerTexte(
      cadre({ contenu_texte: paragraphes("abc def") }),
      avecTypographie({ ancrage: "bas" }),
      mesures,
    );
    // Cadre de 20 à 25 mm, une ligne de 2,4 mm : elle commence à 22,6, ligne de base à 24,4.
    expect(dispose.lignes[0]?.fragments[0]?.y).toBeCloseTo(24.4);
  });

  it("signale un texte plus haut que le cadre", () => {
    const dispose = disposerTexte(
      cadre({ contenu_texte: paragraphes("aaaaaaaaaa bbbbbbbbbb cc") }),
      theme,
      mesures,
    );
    expect(dispose.lignes).toHaveLength(3);
    expect(dispose.deborde).toBe(true);
  });

  it("marque masqué un style que le thème cache, sans perdre ses lignes", () => {
    const dispose = disposerTexte(
      cadre({ contenu_texte: paragraphes("Été") }),
      avecTypographie({ styles_masques: ["titre", "legende"] }),
      mesures,
    );
    expect(dispose.masque).toBe(true);
    expect(dispose.lignes).toHaveLength(1);
  });

  it("ne dispose rien pour un texte absent", () => {
    expect(disposerTexte(cadre(), theme, mesures).lignes).toEqual([]);
  });
});

describe("texte riche", () => {
  const dispose = (
    document: DocumentTexte,
    modif: Partial<TexteAPlacer> = {},
  ) =>
    disposerTexte(
      cadre({ hauteur: 100, largeur: 20, contenu_texte: document, ...modif }),
      theme,
      mesures,
    );

  it("garde ensemble les passages d'un même mot, chacun avec son style", () => {
    const { lignes } = dispose(
      unParagraphe([
        { texte: "ab", gras: true },
        { texte: "cd", souligne: true },
      ]),
    );
    const [gras, souligne] = lignes[0]?.fragments ?? [];
    expect(gras).toMatchObject({
      texte: "ab",
      police: "nunito-700",
      souligne: false,
      x: 10,
    });
    expect(souligne).toMatchObject({
      texte: "cd",
      police: "nunito-400",
      souligne: true,
      x: 12,
    });
  });

  it("ne coupe pas un mot entre deux passages", () => {
    const { lignes } = dispose(
      unParagraphe([
        { texte: "aaaaaaaa bb" },
        { texte: "cccccccc", gras: true },
      ]),
      { largeur: 12 },
    );
    expect(lignes.map(texteDe)).toEqual(["aaaaaaaa", "bbcccccccc"]);
  });

  it("dessine une puce dans la marge et retire le texte de la liste", () => {
    const document: DocumentTexte = {
      version: 1,
      blocs: [
        {
          type: "liste",
          elements: [[{ texte: "un deux trois quatre", gras: true }]],
        },
      ],
    };
    const { lignes } = dispose(document, { largeur: 15 });
    // 15 − 5 de retrait : 10 mm par ligne.
    expect(lignes.map(texteDe)).toEqual(["•un deux", "trois", "quatre"]);
    const [puce, debut] = lignes[0]?.fragments ?? [];
    expect(puce).toMatchObject({ texte: "•", x: 10, police: "nunito-700" });
    expect(debut?.x).toBe(10 + RETRAIT_PUCE_MM);
    // Les lignes suivantes n'ont pas de puce et gardent le retrait.
    expect(lignes[1]?.fragments).toHaveLength(1);
    expect(lignes[1]?.fragments[0]?.x).toBe(10 + RETRAIT_PUCE_MM);
  });

  it("donne à un paragraphe vide la hauteur d'une ligne du thème", () => {
    const document: DocumentTexte = {
      version: 1,
      blocs: [
        { type: "paragraphe", segments: [{ texte: "a" }] },
        { type: "paragraphe", segments: [] },
        { type: "paragraphe", segments: [{ texte: "b" }] },
      ],
    };
    const { lignes } = dispose(document);
    expect(lignes).toHaveLength(3);
    expect(lignes[1]?.fragments).toEqual([]);
    expect(lignes[2]?.haut).toBeCloseTo(20 + 2 * 2.4);
  });
});

describe("tronquerPourTenir", () => {
  it("rend toutes les lignes d'un texte qui tient", () => {
    const dispose = tronquerPourTenir(
      cadre({ contenu_texte: paragraphes("abc") }),
      theme,
      mesures,
    );
    expect(dispose.lignes.map(texteDe)).toEqual(["abc"]);
  });

  it("garde les lignes qui tiennent et termine la dernière par des points de suspension", () => {
    const dispose = tronquerPourTenir(
      cadre({ contenu_texte: paragraphes("aaaaaaaaaa bbbbbbbbbb cc") }),
      theme,
      mesures,
    );
    expect(dispose.lignes.map(texteDe)).toEqual(["aaaaaaaaaa", "bbbbbbbbb…"]);
    expect(dispose.deborde).toBe(true);
  });

  it("termine par « … » dans le style du dernier passage", () => {
    const dispose = tronquerPourTenir(
      cadre({
        contenu_texte: unParagraphe([
          { texte: "aaaaaaaaaa " },
          { texte: "bbbbbbbbbb cc", gras: true },
        ]),
      }),
      theme,
      mesures,
    );
    const derniere = dispose.lignes.at(-1)?.fragments.at(-1);
    expect(derniere).toMatchObject({
      texte: "bbbbbbbbb…",
      police: "nunito-700",
    });
  });

  it("ne rend rien si aucune ligne ne tient", () => {
    const dispose = tronquerPourTenir(
      cadre({ hauteur: 1, contenu_texte: paragraphes("abc") }),
      theme,
      mesures,
    );
    expect(dispose.lignes).toEqual([]);
  });

  it("tient compte de la hauteur de chaque ligne quand les corps diffèrent", () => {
    // Une ligne de 2,4 mm puis une de 4,8 mm dans 5 mm : seule la première tient.
    const dispose = tronquerPourTenir(
      cadre({
        contenu_texte: {
          version: 1,
          blocs: [
            { type: "paragraphe", segments: [{ texte: "a" }] },
            {
              type: "paragraphe",
              segments: [{ texte: "b", taille_pt: (2 / MM_PAR_POINT) * 2 }],
            },
          ],
        },
      }),
      theme,
      mesures,
    );
    expect(dispose.deborde).toBe(true);
    expect(dispose.lignes).toHaveLength(1);
    expect(texteDe(dispose.lignes[0] as LigneDisposee)).toBe("a…");
  });
});

describe("prefixeQuiTient", () => {
  it("rend le texte entier s'il tient", () => {
    expect(prefixeQuiTient(cadre(), theme, mesures, "abc")).toBe("abc");
  });

  it("rend le plus long début qui tient en deux lignes", () => {
    expect(
      prefixeQuiTient(cadre(), theme, mesures, "aaaaaaaaaa bbbbbbbbbb cc"),
    ).toBe("aaaaaaaaaa bbbbbbbbbb ");
  });
});
