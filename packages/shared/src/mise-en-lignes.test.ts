import { describe, expect, it } from "vitest";
import {
  disposerTexte,
  mettreEnLignes,
  prefixeQuiTient,
  type TexteAPlacer,
  tronquerPourTenir,
} from "./mise-en-lignes";
import type { MesureTexte } from "./polices";
import { MM_PAR_POINT, type Typographie } from "./typographie";

// Chasse fixe : chaque caractère fait la moitié de la taille. Ascendant 0,8, descendant 0,2.
const chasseFixe: MesureTexte = {
  largeur: (texte, taille_mm) => texte.length * taille_mm * 0.5,
  ascendant: 0.8,
  descendant: 0.2,
};
const mesures = () => chasseFixe;

// Taille choisie pour qu'un caractère fasse 1 mm et une ligne 2 × 1,2 = 2,4 mm.
const TAILLE_PT = 2 / MM_PAR_POINT;

const typographie: Typographie = {
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
};

const cadre = (modif: Partial<TexteAPlacer> = {}): TexteAPlacer => ({
  x: 10,
  y: 20,
  largeur: 10,
  hauteur: 5,
  style_texte: "legende",
  contenu_texte: "",
  ...modif,
});

describe("mettreEnLignes", () => {
  const lignes = (texte: string, largeur = 10) =>
    mettreEnLignes(texte, largeur, 2, chasseFixe);

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
      cadre({ contenu_texte: "Été" }),
      typographie,
      mesures,
    );
    expect(dispose.lignes).toHaveLength(1);
    expect(dispose.lignes[0]?.x).toBe(10);
    expect(dispose.lignes[0]?.y).toBeCloseTo(21.8);
    expect(dispose.ancre).toBe("debut");
    expect(dispose.taille_mm).toBeCloseTo(2);
    expect(dispose.interligne_mm).toBeCloseTo(2.4);
    expect(dispose.police).toBe("nunito-400");
    expect(dispose.deborde).toBe(false);
    expect(dispose.masque).toBe(false);
  });

  it("prend la police du titre pour un titre et pour le titre de la page de titre", () => {
    for (const style of ["titre", "titre_page"] as const) {
      expect(
        disposerTexte(cadre({ style_texte: style }), typographie, mesures)
          .police,
      ).toBe("nunito-800");
    }
  });

  it("centre sur le milieu du cadre", () => {
    const dispose = disposerTexte(
      cadre({ contenu_texte: "a" }),
      { ...typographie, alignement: "centre" },
      mesures,
    );
    expect(dispose.ancre).toBe("milieu");
    expect(dispose.lignes[0]?.x).toBe(15);
  });

  it("cale sur le bord extérieur : à gauche sur la page de gauche, à droite sur celle de droite", () => {
    const exterieur = { ...typographie, alignement: "exterieur" as const };
    const gauche = disposerTexte(
      cadre({ contenu_texte: "a" }),
      exterieur,
      mesures,
    );
    expect(gauche.ancre).toBe("debut");
    expect(gauche.lignes[0]?.x).toBe(10);

    const droite = disposerTexte(
      cadre({ x: 300, contenu_texte: "a" }),
      exterieur,
      mesures,
    );
    expect(droite.ancre).toBe("fin");
    expect(droite.lignes[0]?.x).toBe(310);
  });

  it("pose le bloc de lignes sur le bas du cadre en ancrage bas", () => {
    const dispose = disposerTexte(
      cadre({ contenu_texte: "abc def" }),
      { ...typographie, ancrage: "bas" },
      mesures,
    );
    // Cadre de 20 à 25 mm, une ligne de 2,4 mm : elle commence à 22,6, ligne de base à 24,4.
    expect(dispose.lignes.map((ligne) => ligne.y)).toHaveLength(1);
    expect(dispose.lignes[0]?.y).toBeCloseTo(24.4);
  });

  it("signale un texte plus haut que le cadre", () => {
    // Trois lignes de 2,4 mm dans 5 mm.
    const dispose = disposerTexte(
      cadre({ contenu_texte: "aaaaaaaaaa bbbbbbbbbb cc" }),
      typographie,
      mesures,
    );
    expect(dispose.lignes).toHaveLength(3);
    expect(dispose.deborde).toBe(true);
  });

  it("marque masqué un style que le thème cache, sans perdre ses lignes", () => {
    const dispose = disposerTexte(
      cadre({ contenu_texte: "Été" }),
      { ...typographie, styles_masques: ["titre", "legende"] },
      mesures,
    );
    expect(dispose.masque).toBe(true);
    expect(dispose.lignes).toHaveLength(1);
  });

  it("ne dispose rien pour un texte absent", () => {
    expect(
      disposerTexte(cadre({ contenu_texte: null }), typographie, mesures)
        .lignes,
    ).toEqual([]);
  });
});

describe("tronquerPourTenir", () => {
  it("rend toutes les lignes d'un texte qui tient", () => {
    const dispose = tronquerPourTenir(
      cadre({ contenu_texte: "abc" }),
      typographie,
      mesures,
    );
    expect(dispose.lignes.map((ligne) => ligne.texte)).toEqual(["abc"]);
  });

  it("garde les lignes qui tiennent et termine la dernière par des points de suspension", () => {
    const dispose = tronquerPourTenir(
      cadre({ contenu_texte: "aaaaaaaaaa bbbbbbbbbb cc" }),
      typographie,
      mesures,
    );
    expect(dispose.lignes.map((ligne) => ligne.texte)).toEqual([
      "aaaaaaaaaa",
      "bbbbbbbbb…",
    ]);
    expect(dispose.deborde).toBe(true);
  });

  it("ne rend rien si aucune ligne ne tient", () => {
    const dispose = tronquerPourTenir(
      cadre({ hauteur: 1, contenu_texte: "abc" }),
      typographie,
      mesures,
    );
    expect(dispose.lignes).toEqual([]);
  });
});

describe("prefixeQuiTient", () => {
  it("rend le texte entier s'il tient", () => {
    expect(prefixeQuiTient(cadre(), typographie, mesures, "abc")).toBe("abc");
  });

  it("rend le plus long début qui tient en deux lignes", () => {
    expect(
      prefixeQuiTient(
        cadre(),
        typographie,
        mesures,
        "aaaaaaaaaa bbbbbbbbbb cc",
      ),
    ).toBe("aaaaaaaaaa bbbbbbbbbb ");
  });
});
