import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  type PDFPage,
  PDFRawStream,
} from "pdf-lib";
import { describe, expect, it } from "vitest";
import { octetsDePolice } from "./polices-de-test";
import {
  type EmplacementARendre,
  type LivreARendre,
  rendre,
} from "./rendu-pdf";
import type { Theme } from "./typographie";

// En-tête JPEG minimal : pdf-lib n'en lit que les dimensions, sans décoder l'image.
// Pas de fichier binaire dans le dépôt, et un octet de remplissage par photo pour les distinguer.
function jpeg(largeur: number, hauteur: number, marque: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8, // SOI
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08, // SOF0, longueur 17, 8 bits
    hauteur >> 8,
    hauteur & 0xff,
    largeur >> 8,
    largeur & 0xff,
    0x03,
    0x01,
    0x22,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
    0xff,
    0xfe,
    0x00,
    0x03,
    marque, // COM
    0xff,
    0xd9, // EOI
  ]);
}

const MM = 72 / 25.4;

const photo = (marque: number) => ({
  octets: jpeg(3000, 2000, marque),
  largeur_px: 3000,
  hauteur_px: 2000,
});

const centre = { cadrage_x: 0.5, cadrage_y: 0.5, cadrage_zoom: 1 };
const sansTexte = { style_texte: null, contenu_texte: null };

const CLASSIQUE: Theme = {
  palette: { fond: "#FAF7F2", texte: "#3E3856" },
  bordure_cadre: null,
  typographie: {
    titre: {
      police: "EB Garamond",
      graisse: 500,
      italique: false,
      taille_pt: 18,
    },
    legende: {
      police: "EB Garamond",
      graisse: 400,
      italique: true,
      taille_pt: 10,
    },
    alignement: "centre",
    ancrage: "haut",
    styles_masques: [],
  },
};

// Le gabarit « Trio », trois photos.
function livreDeTroisPhotos(): LivreARendre {
  return {
    theme: CLASSIQUE,
    polices: {},
    doubles_pages: [
      {
        emplacements: [
          {
            x: 12,
            y: 12,
            largeur: 188,
            hauteur: 186,
            nature: "photo",
            photo: photo(1),
            ...centre,
            ...sansTexte,
          },
          {
            x: 220,
            y: 12,
            largeur: 188,
            hauteur: 88,
            nature: "photo",
            photo: photo(2),
            ...centre,
            ...sansTexte,
          },
          {
            x: 220,
            y: 110,
            largeur: 188,
            hauteur: 88,
            nature: "photo",
            photo: photo(3),
            ...centre,
            ...sansTexte,
          },
        ],
      },
    ],
  };
}

function boite(page: PDFPage, nom: "Media" | "Bleed" | "Trim") {
  const { x, y, width, height } =
    nom === "Media"
      ? page.getMediaBox()
      : nom === "Bleed"
        ? page.getBleedBox()
        : page.getTrimBox();
  return [x, y, width, height].map((valeur) => Math.round(valeur / MM));
}

async function imagesDu(pdf: Uint8Array): Promise<Uint8Array[]> {
  const document = await PDFDocument.load(pdf);
  return document.context
    .enumerateIndirectObjects()
    .map(([, objet]) => objet)
    .filter(
      (objet): objet is PDFRawStream =>
        objet instanceof PDFRawStream &&
        objet.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"),
    )
    .map((flux) => flux.contents);
}

describe("rendre", () => {
  it("produit une page par double page", async () => {
    const livre = livreDeTroisPhotos();
    livre.doubles_pages.push({ emplacements: [] });
    const document = await PDFDocument.load(await rendre(livre));
    expect(document.getPageCount()).toBe(2);
  });

  it("pose les trois boîtes d'impression, en millimètres", async () => {
    const document = await PDFDocument.load(await rendre(livreDeTroisPhotos()));
    const [page] = document.getPages();
    if (!page) throw new Error("Aucune page");
    expect(boite(page, "Media")).toEqual([0, 0, 436, 226]);
    expect(boite(page, "Bleed")).toEqual([5, 5, 426, 216]);
    expect(boite(page, "Trim")).toEqual([8, 8, 420, 210]);
  });

  it("intègre chaque JPEG tel quel, sans le réencoder", async () => {
    const livre = livreDeTroisPhotos();
    const images = await imagesDu(await rendre(livre));
    const attendues = livre.doubles_pages[0]?.emplacements.map(
      (emplacement) => emplacement.photo?.octets,
    );
    expect(images).toHaveLength(3);
    expect(images).toEqual(expect.arrayContaining(attendues ?? []));
  });

  it("n'intègre qu'une fois une photo posée deux fois", async () => {
    const commune = photo(7);
    const livre = livreDeTroisPhotos();
    for (const emplacement of livre.doubles_pages[0]?.emplacements ?? []) {
      emplacement.photo = commune;
    }
    expect(await imagesDu(await rendre(livre))).toHaveLength(1);
  });

  it("rend un emplacement photo vide et ne dessine pas un emplacement texte vide", async () => {
    const livre: LivreARendre = {
      theme: CLASSIQUE,
      polices: {},
      doubles_pages: [
        {
          emplacements: [
            {
              x: 0,
              y: 0,
              largeur: 420,
              hauteur: 140,
              nature: "photo",
              photo: null,
              ...centre,
              ...sansTexte,
            },
            {
              x: 15,
              y: 155,
              largeur: 180,
              hauteur: 40,
              nature: "texte",
              photo: null,
              ...centre,
              ...sansTexte,
            },
          ],
        },
      ],
    };
    const document = await PDFDocument.load(await rendre(livre));
    expect(document.getPageCount()).toBe(1);
    expect(await imagesDu(await rendre(livre))).toHaveLength(0);
  });
});

describe("rendre, les textes", () => {
  const POLICES = {
    "eb-garamond-500": octetsDePolice("eb-garamond-500"),
    "eb-garamond-400-italique": octetsDePolice("eb-garamond-400-italique"),
  };

  // Gabarit 08 : une photo vide, un titre, une légende.
  function livreAvecTextes(
    titre: string | null,
    legende: string | null,
    theme: Theme = CLASSIQUE,
  ): LivreARendre {
    const texte = (
      x: number,
      style: "titre" | "legende",
      contenu: string | null,
    ): EmplacementARendre => ({
      x,
      y: 155,
      largeur: 180,
      hauteur: 40,
      nature: "texte",
      photo: null,
      ...centre,
      style_texte: style,
      contenu_texte: contenu,
    });
    return {
      theme,
      polices: POLICES,
      doubles_pages: [
        {
          emplacements: [
            texte(15, "titre", titre),
            texte(225, "legende", legende),
          ],
        },
      ],
    };
  }

  // Les opérateurs de la page, décompressés : Tj dessine une ligne de texte, S un trait.
  async function operateursDe(pdf: Uint8Array): Promise<string> {
    const document = await PDFDocument.load(pdf);
    const [page] = document.getPages();
    if (!page) throw new Error("Aucune page");
    const contenus = page.node.get(PDFName.of("Contents"));
    const references =
      contenus instanceof PDFArray ? contenus.asArray() : [contenus];
    return references
      .map((reference) => document.context.lookup(reference))
      .filter((flux): flux is PDFRawStream => flux instanceof PDFRawStream)
      .map((flux) =>
        new TextDecoder("latin1").decode(decodePDFRawStream(flux).decode()),
      )
      .join("\n");
  }

  const compter = (operateurs: string, operateur: string) =>
    operateurs
      .split("\n")
      .filter((ligne) => ligne === operateur || ligne.endsWith(` ${operateur}`))
      .length;

  async function policesDu(pdf: Uint8Array): Promise<number> {
    const document = await PDFDocument.load(pdf);
    return document.context
      .enumerateIndirectObjects()
      .filter(
        ([, objet]) =>
          objet instanceof PDFDict &&
          objet.get(PDFName.of("Type")) === PDFName.of("Font") &&
          objet.get(PDFName.of("Subtype")) === PDFName.of("Type0"),
      ).length;
  }

  it("dessine chaque ligne avec la police de son style", async () => {
    const pdf = await rendre(livreAvecTextes("Lisbonne", "Le Tage au matin"));
    expect(compter(await operateursDe(pdf), "Tj")).toBe(2);
    expect(await policesDu(pdf)).toBe(2);
  });

  it("n'intègre que les polices d'un texte dessiné", async () => {
    const pdf = await rendre(livreAvecTextes(null, "Le Tage au matin"));
    expect(compter(await operateursDe(pdf), "Tj")).toBe(1);
    expect(await policesDu(pdf)).toBe(1);
  });

  it("ne dessine rien pour un style masqué par le thème", async () => {
    const silence: Theme = {
      ...CLASSIQUE,
      typographie: {
        ...CLASSIQUE.typographie,
        styles_masques: ["titre", "legende"],
      },
    };
    const pdf = await rendre(
      livreAvecTextes("Lisbonne", "Le Tage au matin", silence),
    );
    expect(compter(await operateursDe(pdf), "Tj")).toBe(0);
    expect(await policesDu(pdf)).toBe(0);
  });

  it("coupe un texte trop long au bas du cadre", async () => {
    // Légende de 10 pt : 4,23 mm par ligne, neuf lignes dans 40 mm ; le texte en demande douze.
    const pdf = await rendre(
      livreAvecTextes(null, "Une longue légende qui ne tient pas. ".repeat(40)),
    );
    expect(compter(await operateursDe(pdf), "Tj")).toBe(9);
  });

  it("trace le filet du thème en haut des cadres texte écrits", async () => {
    const carnet: Theme = { ...CLASSIQUE, bordure_cadre: { filet_pt: 0.5 } };
    const sansFilet = compter(
      await operateursDe(await rendre(livreAvecTextes("Lisbonne", null))),
      "S",
    );
    const avecFilet = compter(
      await operateursDe(
        await rendre(livreAvecTextes("Lisbonne", null, carnet)),
      ),
      "S",
    );
    expect(avecFilet - sansFilet).toBe(1);
  });

  it("échoue plutôt que de substituer une police manquante", async () => {
    const livre = livreAvecTextes("Lisbonne", null);
    livre.polices = {};
    await expect(rendre(livre)).rejects.toThrow("Police manquante");
  });
});
