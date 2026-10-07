import type { MesureTexte, Theme } from "@bookopia/shared";
import { describe, expect, it } from "vitest";
import type { DoublePageDuLivre } from "../api/doublesPages";
import { effetDuTheme, resumeDeLEffet } from "./choixTheme";

type Emplacement = DoublePageDuLivre["emplacement"][number];

// Chasse fixe : chaque caractère fait la moitié de la taille.
const chasseFixe: MesureTexte = {
  largeur: (texte, taille_mm) => texte.length * taille_mm * 0.5,
  ascendant: 0.8,
  descendant: 0.2,
};

const theme = (
  taille_pt: number,
  styles_masques: Theme["typographie"]["styles_masques"] = [],
): Theme => ({
  palette: { fond: "#FFFFFF", texte: "#1E1B2E" },
  bordure_cadre: null,
  typographie: {
    titre: { police: "Nunito", graisse: 800, italique: false, taille_pt },
    legende: { police: "Nunito", graisse: 400, italique: false, taille_pt },
    alignement: "gauche",
    ancrage: "haut",
    styles_masques,
  },
});

const texte = (
  style_texte: "titre" | "legende",
  contenu_texte: string | null,
): Emplacement => ({
  id: crypto.randomUUID(),
  indice: 0,
  nature: "texte",
  style_texte,
  x: 0,
  y: 0,
  largeur: 60,
  hauteur: 10,
  photo_id: null,
  cadrage_x: null,
  cadrage_y: null,
  cadrage_zoom: null,
  contenu_texte,
});

const livre = (...emplacements: Emplacement[]): DoublePageDuLivre[] => [
  {
    id: "d1",
    role: "interieur",
    position: 1,
    gabarit_origine_id: null,
    emplacement: emplacements,
  },
];

describe("effetDuTheme", () => {
  const ecrits = livre(
    texte("titre", "Lisbonne"),
    texte("legende", "Le Tage au matin, puis le tram jusqu'au château"),
    texte("legende", null),
  );

  it("ne signale rien quand tout tient et reste visible", () => {
    expect(effetDuTheme(ecrits, theme(9), () => chasseFixe)).toEqual({
      masques: 0,
      coupes: 0,
    });
  });

  it("compte les textes écrits que le thème masque", () => {
    expect(
      effetDuTheme(ecrits, theme(9, ["titre", "legende"]), () => chasseFixe),
    ).toEqual({
      masques: 2,
      coupes: 0,
    });
  });

  it("compte les textes qui ne tiennent plus avec une police plus grande", () => {
    // 15 pt : 2,6 mm par caractère, 23 caractères par ligne, deux lignes de 6,35 mm dans 10 mm : une seule tient.
    expect(effetDuTheme(ecrits, theme(15), () => chasseFixe)).toEqual({
      masques: 0,
      coupes: 1,
    });
  });
});

describe("resumeDeLEffet", () => {
  it("ne dit rien si rien ne change", () => {
    expect(resumeDeLEffet({ masques: 0, coupes: 0 })).toBe("");
  });

  it("accorde au singulier et au pluriel", () => {
    expect(resumeDeLEffet({ masques: 3, coupes: 1 })).toBe(
      "3 textes seront masqués · 1 texte sera coupé",
    );
    expect(resumeDeLEffet({ masques: 1, coupes: 0 })).toBe(
      "1 texte sera masqué",
    );
  });
});
