import { describe, expect, it } from "vitest";
import {
  documentDepuisTexte,
  documentTexteSchema,
  estVide,
  lireDocumentTexte,
  longueurTexte,
  texteBrut,
} from "./texte-riche";
import { CATALOGUE_POLICES, varianteDePolice } from "./polices";

const document = {
  version: 1,
  blocs: [
    {
      type: "paragraphe",
      alignement: "centre",
      segments: [
        { texte: "Été ", gras: true },
        {
          texte: "2026",
          police: "Nunito",
          taille_pt: 24,
          couleur: "#8a3b2e",
        },
      ],
    },
    {
      type: "liste",
      elements: [[{ texte: "Premier point" }], [{ texte: "Second point" }]],
    },
  ],
};

describe("documentTexteSchema", () => {
  it("accepte un document complet", () => {
    expect(documentTexteSchema.parse(document)).toEqual(document);
  });

  it.each([
    ["une autre version", { ...document, version: 2 }],
    ["une clé inconnue", { ...document, extra: true }],
    [
      "un segment vide",
      {
        version: 1,
        blocs: [{ type: "paragraphe", segments: [{ texte: "" }] }],
      },
    ],
    [
      "une taille sous 6 pt",
      {
        version: 1,
        blocs: [
          { type: "paragraphe", segments: [{ texte: "a", taille_pt: 5 }] },
        ],
      },
    ],
    [
      "une taille au-dessus de 72 pt",
      {
        version: 1,
        blocs: [
          { type: "paragraphe", segments: [{ texte: "a", taille_pt: 73 }] },
        ],
      },
    ],
    [
      "une couleur mal formée",
      {
        version: 1,
        blocs: [
          { type: "paragraphe", segments: [{ texte: "a", couleur: "rouge" }] },
        ],
      },
    ],
    [
      "une police hors du catalogue",
      {
        version: 1,
        blocs: [
          {
            type: "paragraphe",
            segments: [{ texte: "a", police: "Comic Sans" }],
          },
        ],
      },
    ],
    [
      "un alignement justifié",
      {
        version: 1,
        blocs: [{ type: "paragraphe", alignement: "justifie", segments: [] }],
      },
    ],
    [
      "un bloc inconnu",
      { version: 1, blocs: [{ type: "titre", segments: [] }] },
    ],
  ])("refuse %s", (_nom, valeur) => {
    expect(documentTexteSchema.safeParse(valeur).success).toBe(false);
  });
});

describe("outils du document", () => {
  const parse = documentTexteSchema.parse(document);

  it("rend le texte brut, une ligne par paragraphe ou élément de liste", () => {
    expect(texteBrut(parse)).toBe("Été 2026\nPremier point\nSecond point");
  });

  it("compte les caractères des segments, sans les séparateurs", () => {
    expect(longueurTexte(parse)).toBe(
      "Été 2026Premier pointSecond point".length,
    );
  });

  it("convertit un texte simple en un paragraphe par ligne", () => {
    expect(documentDepuisTexte("Été\n\nLisbonne")).toEqual({
      version: 1,
      blocs: [
        { type: "paragraphe", segments: [{ texte: "Été" }] },
        { type: "paragraphe", segments: [] },
        { type: "paragraphe", segments: [{ texte: "Lisbonne" }] },
      ],
    });
    expect(documentDepuisTexte("")).toBeNull();
  });

  it("ne tient pour vide que l'absence de texte visible", () => {
    expect(estVide(null)).toBe(true);
    expect(estVide(documentDepuisTexte("  "))).toBe(true);
    expect(estVide(parse)).toBe(false);
  });

  it("lit null comme un cadre vidé et refuse un document mal formé", () => {
    expect(lireDocumentTexte(null)).toBeNull();
    expect(() => lireDocumentTexte({ version: 3 })).toThrow();
  });
});

describe("catalogue des variantes", () => {
  it("donne la variante réelle d'une famille", () => {
    expect(varianteDePolice("Nunito", true, false)).toBe("nunito-700");
    expect(varianteDePolice("EB Garamond", false, true)).toBe(
      "eb-garamond-400-italique",
    );
  });

  it("ne fabrique ni faux gras ni faux italique", () => {
    expect(varianteDePolice("Caveat", true, false)).toBeNull();
    expect(varianteDePolice("Nunito", false, true)).toBeNull();
    expect(varianteDePolice("Nunito", true, true)).toBe("nunito-700");
  });

  it("ne déclare que des fichiers qui existent", async () => {
    const { FICHIERS_POLICES } = await import("./polices");
    for (const variantes of Object.values(CATALOGUE_POLICES)) {
      for (const cle of Object.values(variantes)) {
        if (cle) expect(Object.keys(FICHIERS_POLICES)).toContain(cle);
      }
    }
  });
});
