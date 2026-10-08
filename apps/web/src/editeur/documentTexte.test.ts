import type { DocumentTexte } from "@bookopia/shared";
import { describe, expect, it } from "vitest";
import { depuisTiptap, versTiptap } from "./documentTexte";

const riche: DocumentTexte = {
  version: 1,
  blocs: [
    {
      type: "paragraphe",
      alignement: "centre",
      segments: [
        { texte: "Été ", gras: true },
        {
          texte: "2026",
          police: "Great Vibes",
          taille_pt: 24,
          couleur: "#8a3b2e",
        },
        { texte: " souligné", gras: true, italique: true, souligne: true },
      ],
    },
    { type: "paragraphe", segments: [] },
    {
      type: "liste",
      elements: [[{ texte: "Un" }], [], [{ texte: "Trois", italique: true }]],
    },
  ],
};

describe("documentTexte", () => {
  it("fait l'aller-retour sans rien perdre", () => {
    expect(depuisTiptap(versTiptap(riche))).toEqual(riche);
    expect(JSON.stringify(depuisTiptap(versTiptap(riche)))).toBe(
      JSON.stringify(riche),
    );
  });

  it("un cadre vide est un paragraphe vide, et revient null", () => {
    const vide = versTiptap(null);
    expect(vide.content).toEqual([{ type: "paragraph" }]);
    expect(depuisTiptap(vide)).toBeNull();
  });

  it("fusionne les passages voisins de même mise en forme", () => {
    const resultat = depuisTiptap({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Bon", marks: [{ type: "bold" }] },
            { type: "text", text: "jour", marks: [{ type: "bold" }] },
            { type: "text", text: "!" },
          ],
        },
      ],
    });
    expect(resultat?.blocs).toEqual([
      {
        type: "paragraphe",
        segments: [{ texte: "Bonjour", gras: true }, { texte: "!" }],
      },
    ]);
  });

  it("un réglage sans valeur n'écrit aucun écart", () => {
    const resultat = depuisTiptap({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Texte",
              marks: [
                {
                  type: "reglage",
                  attrs: { police: null, taille_pt: null, couleur: null },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(resultat?.blocs).toEqual([
      { type: "paragraphe", segments: [{ texte: "Texte" }] },
    ]);
  });

  it("refuse un corps hors bornes plutôt que de l'écrire", () => {
    expect(() =>
      depuisTiptap({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "x",
                marks: [{ type: "reglage", attrs: { taille_pt: 200 } }],
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});
