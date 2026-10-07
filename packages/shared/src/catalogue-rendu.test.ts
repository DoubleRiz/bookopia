import { readFileSync } from "node:fs";
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
} from "pdf-lib";
import { describe, expect, it } from "vitest";
import { type DefinitionGabarit, definitionGabaritSchema } from "./gabarit";
import { FICHIERS_POLICES, type ClePolice } from "./polices";
import { octetsDePolice } from "./polices-de-test";
import { type LivreARendre, rendre } from "./rendu-pdf";
import { type Theme, themeSchema } from "./typographie";

// Le catalogue du seed, lu tel quel : si un gabarit ou un thème y change, ce test le rend aussi.
const seed = readFileSync(
  new URL("../../../supabase/seed.sql", import.meta.url),
  "utf8",
);

const gabarits: DefinitionGabarit[] = (
  seed.match(/'\[\s*\{[\s\S]*?\}\s*\]'/g) ?? []
).map((json) => definitionGabaritSchema.parse(JSON.parse(json.slice(1, -1))));

const themes: { nom: string; theme: Theme }[] = [
  ...seed.matchAll(
    /\('00000000-0000-4000-a000-\d+', '([^']+)',\s*'(\{[^']*\})', 0, (null|'[^']*'), 0, '(\{[\s\S]*?\})'\)/g,
  ),
].map(([, nom = "", palette = "", bordure = "", typographie = ""]) => ({
  nom,
  theme: themeSchema.parse({
    palette: JSON.parse(palette),
    bordure_cadre: bordure === "null" ? null : JSON.parse(bordure.slice(1, -1)),
    typographie: JSON.parse(typographie),
  }),
}));

const POLICES = Object.fromEntries(
  (Object.keys(FICHIERS_POLICES) as ClePolice[]).map((cle) => [
    cle,
    octetsDePolice(cle),
  ]),
);

// En-tête JPEG minimal : pdf-lib n'en lit que les dimensions.
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x07, 0xd0, 0x0b, 0xb8, 0x03, 0x01,
  0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9,
]);

function livreDe(gabarit: DefinitionGabarit, theme: Theme): LivreARendre {
  return {
    theme,
    polices: POLICES,
    doubles_pages: [
      {
        emplacements: gabarit.map((cadre) => ({
          x: cadre.x,
          y: cadre.y,
          largeur: cadre.largeur,
          hauteur: cadre.hauteur,
          nature: cadre.nature,
          photo:
            cadre.nature === "photo"
              ? { octets: JPEG, largeur_px: 3000, hauteur_px: 2000 }
              : null,
          cadrage_x: 0.5,
          cadrage_y: 0.5,
          cadrage_zoom: 1,
          style_texte: cadre.style ?? null,
          contenu_texte: cadre.nature === "texte" ? "Lisbonne au matin" : null,
        })),
      },
    ],
  };
}

async function compterLignesDeTexte(pdf: Uint8Array): Promise<number> {
  const document = await PDFDocument.load(pdf);
  const [page] = document.getPages();
  const contenus = page?.node.get(PDFName.of("Contents"));
  const references =
    contenus instanceof PDFArray ? contenus.asArray() : [contenus];
  return references
    .map((reference) => document.context.lookup(reference))
    .filter((flux): flux is PDFRawStream => flux instanceof PDFRawStream)
    .map((flux) =>
      new TextDecoder("latin1").decode(decodePDFRawStream(flux).decode()),
    )
    .join("\n")
    .split("\n")
    .filter((ligne) => ligne === "Tj" || ligne.endsWith(" Tj")).length;
}

describe("le catalogue du seed", () => {
  it("contient les gabarits (11 intérieurs, couverture, quatrième) et 4 thèmes", () => {
    // 11 intérieurs, puis la définition partagée des couvertures et celle des quatrièmes.
    expect(gabarits).toHaveLength(13);
    expect(themes.map(({ nom }) => nom)).toEqual([
      "Classique",
      "Moderne",
      "Carnet",
      "Silence",
    ]);
  });

  describe.each(themes)("rendu avec le thème $nom", ({ theme }) => {
    it.each(gabarits.map((definition, i) => ({ definition, i })))(
      "rend le gabarit $i sans erreur, une page, du texte sauf s'il est masqué",
      async ({ definition }) => {
        const pdf = await rendre(livreDe(definition, theme));
        const document = await PDFDocument.load(pdf);
        expect(document.getPageCount()).toBe(1);

        const visibles = definition.filter(
          (cadre) =>
            cadre.nature === "texte" &&
            cadre.style &&
            !theme.typographie.styles_masques.includes(cadre.style),
        ).length;
        const lignes = await compterLignesDeTexte(pdf);
        if (visibles === 0) expect(lignes).toBe(0);
        else expect(lignes).toBeGreaterThanOrEqual(visibles);
      },
    );
  });
});
