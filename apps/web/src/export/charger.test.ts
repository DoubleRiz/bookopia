import {
  type ClePolice,
  documentDepuisTexte,
  type Theme,
} from "@bookopia/shared";
import { describe, expect, it } from "vitest";
import {
  charger,
  type LivreLu,
  type PhotoPosee,
  policesUtiles,
  type Sources,
} from "./charger";

const THEME: Theme = {
  palette: { fond: "#FFFFFF", texte: "#1E1B2E" },
  bordure_cadre: null,
  typographie: {
    titre: { police: "Nunito", graisse: 800, italique: false, taille_pt: 18 },
    legende: { police: "Caveat", graisse: 600, italique: false, taille_pt: 15 },
    alignement: "gauche",
    ancrage: "haut",
    styles_masques: [],
  },
};

const photo = (id: string): PhotoPosee => ({
  id,
  cle_stockage: `cle-${id}`,
  largeur_px: 4000,
  hauteur_px: 3000,
});

const sansTexte = { style_texte: null, contenu_texte: null };

const emplacement = (posee: PhotoPosee | null) => ({
  x: 0,
  y: 0,
  largeur: 100,
  hauteur: 100,
  nature: "photo" as const,
  photo: posee,
  cadrage_x: posee ? 0.3 : null,
  cadrage_y: posee ? 0.7 : null,
  cadrage_zoom: posee ? 2 : null,
  ...sansTexte,
});

const texte = (
  style_texte: "titre" | "titre_page" | "legende",
  contenu_texte: string | null,
) => ({
  ...emplacement(null),
  nature: "texte" as const,
  style_texte,
  contenu_texte: documentDepuisTexte(contenu_texte ?? ""),
});

function livre(...doublesPages: (PhotoPosee | null)[][]): LivreLu {
  return {
    theme: THEME,
    doubles_pages: doublesPages.map((photos) => ({
      emplacements: photos.map(emplacement),
    })),
  };
}

const octetsDe = (cle: string) => new TextEncoder().encode(cle);

// Les photos selon le test ; chaque police rend son nom en octets.
const sources = (photo: Sources["photo"]): Sources => ({
  photo,
  police: async (cle) => octetsDe(cle),
});

describe("charger", () => {
  it("télécharge chaque original et garde l'ordre du livre", async () => {
    const rendu = await charger(
      livre([photo("a"), null], [photo("b")]),
      sources(async (posee) => octetsDe(posee.cle_stockage)),
    );
    expect(rendu.doubles_pages).toHaveLength(2);
    expect(rendu.doubles_pages[0]?.emplacements[0]).toMatchObject({
      photo: { octets: octetsDe("cle-a"), largeur_px: 4000, hauteur_px: 3000 },
      cadrage_x: 0.3,
      cadrage_y: 0.7,
      cadrage_zoom: 2,
    });
    expect(rendu.doubles_pages[0]?.emplacements[1]?.photo).toBeNull();
    expect(rendu.doubles_pages[1]?.emplacements[0]?.photo?.octets).toEqual(
      octetsDe("cle-b"),
    );
  });

  it("ne télécharge qu'une fois une photo posée deux fois, et partage ses octets", async () => {
    const telechargees: string[] = [];
    const a = photo("a");
    const rendu = await charger(
      livre([a], [a]),
      sources(async (posee) => {
        telechargees.push(posee.id);
        return octetsDe(posee.cle_stockage);
      }),
    );
    expect(telechargees).toEqual(["a"]);
    expect(rendu.doubles_pages[0]?.emplacements[0]?.photo?.octets).toBe(
      rendu.doubles_pages[1]?.emplacements[0]?.photo?.octets,
    );
  });

  it("publie l'avancement photo par photo", async () => {
    const avancement: [number, number][] = [];
    await charger(
      livre([photo("a"), photo("b"), photo("c")]),
      sources(async (posee) => octetsDe(posee.id)),
      { onAvancement: (faits, total) => avancement.push([faits, total]) },
    );
    expect(avancement).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it("refait une fois un téléchargement en échec", async () => {
    let essais = 0;
    await charger(
      livre([photo("a")]),
      sources(async (posee) => {
        essais += 1;
        if (essais === 1) throw new Error("coupure");
        return octetsDe(posee.id);
      }),
    );
    expect(essais).toBe(2);
  });

  it("échoue en entier si une photo reste introuvable", async () => {
    await expect(
      charger(
        livre([photo("a"), photo("b")]),
        sources(async (posee) => {
          if (posee.id === "b") throw new Error("absent");
          return octetsDe(posee.id);
        }),
      ),
    ).rejects.toThrow("absent");
  });

  it("passe le thème, les textes et les polices au rendu", async () => {
    const lu = livre();
    lu.doubles_pages.push({ emplacements: [texte("legende", "Lisbonne")] });
    const rendu = await charger(
      lu,
      sources(async () => new Uint8Array()),
    );
    expect(rendu.theme).toBe(THEME);
    expect(rendu.polices).toEqual({ "caveat-600": octetsDe("caveat-600") });
    expect(rendu.doubles_pages[0]?.emplacements[0]).toMatchObject({
      style_texte: "legende",
      contenu_texte: documentDepuisTexte("Lisbonne"),
    });
  });
});

describe("policesUtiles", () => {
  const avecTextes = (
    theme: Theme,
    ...textes: ReturnType<typeof texte>[]
  ): ClePolice[] =>
    policesUtiles({ theme, doubles_pages: [{ emplacements: textes }] });

  it("ne demande que les polices des textes écrits", () => {
    expect(
      avecTextes(THEME, texte("titre", "Été"), texte("legende", "  ")),
    ).toEqual(["nunito-800"]);
    expect(avecTextes(THEME, texte("titre_page", "Été"))).toEqual([
      "nunito-800",
    ]);
  });

  it("ignore les textes que le thème masque", () => {
    const silence: Theme = {
      ...THEME,
      typographie: { ...THEME.typographie, styles_masques: ["legende"] },
    };
    expect(avecTextes(silence, texte("legende", "Lisbonne"))).toEqual([]);
  });
});
