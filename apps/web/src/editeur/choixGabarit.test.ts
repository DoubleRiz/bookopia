import type { DefinitionGabarit, GabaritAComposer } from "@bookopia/shared";
import { describe, expect, it } from "vitest";
import type { DoublePageDuLivre } from "../api/doublesPages";
import { aDuContenu, apercuDuGabarit, resumeDuGabarit } from "./choixGabarit";

type Emplacement = DoublePageDuLivre["emplacement"][number];

const cadre = (indice: number, nature: "photo" | "texte") => ({
  indice,
  nature,
  x: 10 * indice,
  y: 5,
  largeur: 100,
  hauteur: 50,
  ...(nature === "texte" ? { style: "legende" as const } : {}),
});

const gabarit = (
  id: string,
  natures: ("photo" | "texte")[],
): GabaritAComposer => ({
  id,
  nom: `Gabarit ${id}`,
  definition: natures.map((nature, indice) =>
    cadre(indice, nature),
  ) as DefinitionGabarit,
});

function emplacement(autres: Partial<Emplacement>): Emplacement {
  return {
    id: crypto.randomUUID(),
    indice: 0,
    nature: "photo",
    x: 0,
    y: 0,
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

function doublePage(emplacements: Emplacement[]): DoublePageDuLivre {
  return {
    id: "d1",
    role: "interieur",
    position: 2,
    gabarit_origine_id: "b1",
    emplacement: emplacements,
  };
}

describe("aDuContenu", () => {
  it("est faux pour une double page aux cadres vides", () => {
    expect(
      aDuContenu(
        doublePage([
          emplacement({ indice: 0 }),
          emplacement({ indice: 1, nature: "texte" }),
        ]),
      ),
    ).toBe(false);
  });

  it("est vrai dès qu'une photo est posée", () => {
    expect(aDuContenu(doublePage([emplacement({ photo_id: "p1" })]))).toBe(
      true,
    );
  });

  it("est vrai dès qu'un texte est saisi", () => {
    expect(
      aDuContenu(
        doublePage([emplacement({ nature: "texte", contenu_texte: "Été" })]),
      ),
    ).toBe(true);
  });

  it("ignore un texte fait seulement d'espaces", () => {
    expect(
      aDuContenu(
        doublePage([emplacement({ nature: "texte", contenu_texte: "  " })]),
      ),
    ).toBe(false);
  });
});

describe("apercuDuGabarit", () => {
  it("dessine les cadres du gabarit, vides, au rang de la double page", () => {
    const apercu = apercuDuGabarit(gabarit("b9", ["photo", "texte"]), 4);
    expect(apercu.position).toBe(4);
    expect(apercu.role).toBe("interieur");
    expect(
      apercu.emplacement.map(
        ({ indice, nature, x, photo_id, contenu_texte, style_texte }) => ({
          indice,
          nature,
          x,
          photo_id,
          contenu_texte,
          style_texte,
        }),
      ),
    ).toEqual([
      {
        indice: 0,
        nature: "photo",
        x: 0,
        photo_id: null,
        contenu_texte: null,
        style_texte: null,
      },
      {
        indice: 1,
        nature: "texte",
        x: 10,
        photo_id: null,
        contenu_texte: null,
        style_texte: "legende",
      },
    ]);
  });

  it("donne à chaque cadre un identifiant distinct", () => {
    const apercu = apercuDuGabarit(gabarit("b9", ["photo", "photo"]), 1);
    expect(new Set(apercu.emplacement.map((e) => e.id)).size).toBe(2);
  });
});

describe("resumeDuGabarit", () => {
  it("compte les photos, au singulier et au pluriel", () => {
    expect(resumeDuGabarit(gabarit("b1", ["photo"]))).toBe("1 photo");
    expect(resumeDuGabarit(gabarit("b3", ["photo", "photo"]))).toBe("2 photos");
  });

  it("ajoute les textes quand il y en a", () => {
    expect(resumeDuGabarit(gabarit("b8", ["photo", "texte", "texte"]))).toBe(
      "1 photo · 2 textes",
    );
    expect(resumeDuGabarit(gabarit("b10", ["photo", "texte"]))).toBe(
      "1 photo · 1 texte",
    );
  });
});
