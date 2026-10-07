import { describe, expect, it } from "vitest";
import {
  composerLivre,
  coutDuCadre,
  type GabaritAComposer,
  type PhotoAComposer,
} from "./composition";
import type { Cadre } from "./gabarit";

let compteur = 0;
function photo(
  largeur_px: number,
  hauteur_px: number,
  autres: Partial<PhotoAComposer> = {},
): PhotoAComposer {
  compteur += 1;
  return {
    id: `p${String(compteur).padStart(3, "0")}`,
    largeur_px,
    hauteur_px,
    prise_le: null,
    cree_le: `2026-10-07T10:00:${String(compteur % 60).padStart(2, "0")}Z`,
    ...autres,
  };
}
const paysage = (autres: Partial<PhotoAComposer> = {}) =>
  photo(3000, 2000, autres);
const portrait = (autres: Partial<PhotoAComposer> = {}) =>
  photo(2000, 3000, autres);

function cadre(
  indice: number,
  largeur: number,
  hauteur: number,
  nature: Cadre["nature"] = "photo",
): Cadre {
  return { indice, x: 0, y: 0, largeur, hauteur, nature };
}
function gabarit(nom: string, cadres: Cadre[]): GabaritAComposer {
  return { id: `g-${nom}`, nom, definition: cadres };
}

// Un cadre paysage 3:2 et un cadre portrait 2:3, pour lire les choix sans ambiguïté.
const unPaysage = gabarit("Un paysage", [cadre(0, 300, 200)]);
const unPortrait = gabarit("Un portrait", [cadre(0, 200, 300)]);
const duoMixte = gabarit("Duo mixte", [cadre(0, 300, 200), cadre(1, 200, 300)]);

const nombreDePoses = (livre: ReturnType<typeof composerLivre>) =>
  livre.reduce((total, doublePage) => total + doublePage.poses.length, 0);

describe("coutDuCadre", () => {
  it("vaut 0 quand la photo a les proportions du cadre", () => {
    expect(coutDuCadre(paysage(), cadre(0, 300, 200))).toBe(0);
  });

  it("vaut la part de l'image perdue au recadrage", () => {
    expect(coutDuCadre(photo(3000, 4000), cadre(0, 300, 100))).toBeCloseTo(
      0.75,
    );
  });

  it("ne dépend pas du sens de l'écart", () => {
    expect(coutDuCadre(photo(1000, 1000), cadre(0, 200, 100))).toBeCloseTo(
      coutDuCadre(photo(2000, 1000), cadre(0, 100, 100)),
    );
  });
});

describe("composerLivre", () => {
  it("renvoie une liste vide sans photo", () => {
    expect(composerLivre([], [unPaysage])).toEqual([]);
  });

  it("renvoie une liste vide sans gabarit", () => {
    expect(composerLivre([paysage()], [])).toEqual([]);
  });

  it("ignore un gabarit sans cadre photo", () => {
    const texteSeul = gabarit("Texte seul", [cadre(0, 100, 50, "texte")]);
    expect(composerLivre([paysage()], [texteSeul])).toEqual([]);
  });

  it("pose les photos dans l'ordre de prise de vue, les photos sans date à la fin", () => {
    const sansDate = paysage({ cree_le: "2026-01-01T00:00:00Z" });
    const tardive = paysage({ prise_le: "2025-08-02T10:00:00Z" });
    const matinale = paysage({ prise_le: "2025-08-01T10:00:00Z" });
    const livre = composerLivre([sansDate, tardive, matinale], [unPaysage]);
    expect(livre.flatMap((d) => d.poses.map((p) => p.photo_id))).toEqual([
      matinale.id,
      tardive.id,
      sansDate.id,
    ]);
  });

  it("range les photos sans date par création, puis par identifiant", () => {
    const b = paysage({ id: "b", cree_le: "2026-01-01T00:00:00Z" });
    const a = paysage({ id: "a", cree_le: "2026-01-01T00:00:00Z" });
    const premiere = paysage({ id: "z", cree_le: "2025-01-01T00:00:00Z" });
    const livre = composerLivre([b, a, premiere], [unPaysage]);
    expect(livre.flatMap((d) => d.poses.map((p) => p.photo_id))).toEqual([
      "z",
      "a",
      "b",
    ]);
  });

  it("pose chaque photo exactement une fois", () => {
    const photos = [paysage(), portrait(), paysage(), portrait(), paysage()];
    const livre = composerLivre(photos, [unPaysage, unPortrait, duoMixte]);
    const posees = livre.flatMap((d) => d.poses.map((p) => p.photo_id));
    expect(posees.sort()).toEqual(photos.map((p) => p.id).sort());
  });

  it("oriente une photo portrait vers un cadre portrait", () => {
    const livre = composerLivre([portrait()], [unPaysage, unPortrait]);
    expect(livre).toEqual([
      {
        gabarit_id: unPortrait.id,
        poses: [{ indice: 0, photo_id: expect.any(String) }],
      },
    ]);
  });

  it("répartit les photos d'une double page sur les cadres qui leur vont", () => {
    const enPortrait = portrait();
    const enPaysage = paysage();
    const livre = composerLivre([enPortrait, enPaysage], [duoMixte]);
    expect(livre).toEqual([
      {
        gabarit_id: duoMixte.id,
        poses: [
          { indice: 1, photo_id: enPortrait.id },
          { indice: 0, photo_id: enPaysage.id },
        ],
      },
    ]);
  });

  it("laisse les cadres texte vides", () => {
    const avecLegende = gabarit("Avec légende", [
      cadre(0, 100, 50, "texte"),
      cadre(1, 300, 200),
    ]);
    const livre = composerLivre([paysage()], [avecLegende]);
    expect(livre[0]?.poses.map((p) => p.indice)).toEqual([1]);
  });

  it("préfère un nombre de photos qui tombe juste à des cadres vides", () => {
    const duo = gabarit("Duo", [cadre(0, 300, 200), cadre(1, 300, 200)]);
    const trio = gabarit("Trio", [
      cadre(0, 300, 200),
      cadre(1, 300, 200),
      cadre(2, 300, 200),
    ]);
    const livre = composerLivre(
      [paysage(), paysage(), paysage(), paysage(), paysage()],
      [duo, trio],
    );
    expect(livre.map((d) => d.poses.length).sort()).toEqual([2, 3]);
  });

  it("laisse des cadres vides sur la dernière double page seulement, quand rien ne tombe juste", () => {
    const duo = gabarit("Duo", [cadre(0, 300, 200), cadre(1, 300, 200)]);
    const livre = composerLivre([paysage(), paysage(), paysage()], [duo]);
    expect(livre.map((d) => d.poses.length)).toEqual([2, 1]);
  });

  it("préfère un cadre vide à rien : une seule photo dans un duo", () => {
    const duo = gabarit("Duo", [cadre(0, 300, 200), cadre(1, 200, 300)]);
    const seule = portrait();
    expect(composerLivre([seule], [duo])).toEqual([
      { gabarit_id: duo.id, poses: [{ indice: 1, photo_id: seule.id }] },
    ]);
  });

  it("préfère un recadrage, même mauvais, à un cadre vide", () => {
    // Deux portraits dans des panoramiques 6:1 perdent près de 90 % de l'image,
    // mais un trio parfait laisserait un cadre vide.
    const duoPanoramique = gabarit("Duo panoramique", [
      cadre(0, 600, 100),
      cadre(1, 600, 100),
    ]);
    const trioPortrait = gabarit("Trio portrait", [
      cadre(0, 200, 300),
      cadre(1, 200, 300),
      cadre(2, 200, 300),
    ]);
    const livre = composerLivre(
      [portrait(), portrait()],
      [duoPanoramique, trioPortrait],
    );
    expect(livre.map((d) => d.gabarit_id)).toEqual([duoPanoramique.id]);
  });

  it("alterne les gabarits quand la répétition coûte plus que l'écart", () => {
    const paysageLarge = gabarit("Paysage large", [cadre(0, 320, 200)]);
    const livre = composerLivre(
      [paysage(), paysage(), paysage(), paysage()],
      [unPaysage, paysageLarge],
    );
    const suite = livre.map((d) => d.gabarit_id);
    for (let rang = 1; rang < suite.length; rang += 1) {
      expect(suite[rang]).not.toBe(suite[rang - 1]);
    }
  });

  it("départage deux gabarits identiques par leur nom", () => {
    // Identifiants dans l'ordre inverse des noms : seul le nom peut donner « A ».
    const b = { ...gabarit("B", [cadre(0, 300, 200)]), id: "g-1" };
    const a = { ...gabarit("A", [cadre(0, 300, 200)]), id: "g-2" };
    expect(composerLivre([paysage()], [b, a])[0]?.gabarit_id).toBe(a.id);
  });

  it("donne le même livre quel que soit l'ordre des entrées", () => {
    const photos = [
      paysage({ prise_le: "2025-08-01T10:00:00Z" }),
      portrait({ prise_le: "2025-08-01T11:00:00Z" }),
      paysage(),
      portrait(),
      paysage(),
      paysage(),
    ];
    const gabarits = [unPaysage, unPortrait, duoMixte];
    expect(
      composerLivre([...photos].reverse(), [...gabarits].reverse()),
    ).toEqual(composerLivre(photos, gabarits));
  });

  it("compose un livre de plusieurs centaines de photos", () => {
    const photos = Array.from({ length: 400 }, (_, rang) =>
      rang % 3 === 0 ? portrait() : paysage(),
    );
    const mosaique = gabarit(
      "Mosaïque",
      Array.from({ length: 6 }, (_, indice) => cadre(indice, 87, 58)),
    );
    const livre = composerLivre(photos, [
      unPaysage,
      unPortrait,
      duoMixte,
      mosaique,
    ]);
    expect(nombreDePoses(livre)).toBe(400);
  });
});
