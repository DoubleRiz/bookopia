import { PDFDocument, PDFName, PDFRawStream, type PDFPage } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { type LivreARendre, rendre } from "./rendu-pdf";

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

// Le gabarit « Trio », trois photos.
function livreDeTroisPhotos(): LivreARendre {
  return {
    fond: "#FAF7F2",
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
          },
          {
            x: 220,
            y: 12,
            largeur: 188,
            hauteur: 88,
            nature: "photo",
            photo: photo(2),
            ...centre,
          },
          {
            x: 220,
            y: 110,
            largeur: 188,
            hauteur: 88,
            nature: "photo",
            photo: photo(3),
            ...centre,
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

  it("rend un emplacement photo vide et ignore les emplacements texte", async () => {
    const livre: LivreARendre = {
      fond: "#FFFFFF",
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
            },
            {
              x: 15,
              y: 155,
              largeur: 180,
              hauteur: 40,
              nature: "texte",
              photo: null,
              ...centre,
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
