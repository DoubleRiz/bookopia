import { documentDepuisTexte } from "@bookopia/shared";
import { describe, expect, it } from "vitest";
import type {
  DoublePageDuLivre,
  EmplacementDuLivre,
} from "../api/doublesPages";
import { emplacementDe, etatInitial, reduireEditeur } from "./etatEditeur";

function emplacement(
  id: string,
  autres: Partial<EmplacementDuLivre> = {},
): EmplacementDuLivre {
  return {
    id,
    indice: 0,
    nature: "photo",
    x: 0,
    y: 0,
    largeur: 200,
    hauteur: 210,
    photo_id: null,
    cadrage_x: null,
    cadrage_y: null,
    cadrage_zoom: null,
    contenu_texte: null,
    style_texte: null,
    ...autres,
  };
}

const page = (
  id: string,
  emplacements: EmplacementDuLivre[],
): DoublePageDuLivre => ({
  id,
  role: "interieur",
  position: 1,
  gabarit_origine_id: null,
  emplacement: emplacements,
});

const pose = emplacement("e2", {
  photo_id: "p1",
  cadrage_x: 0.2,
  cadrage_y: 0.7,
  cadrage_zoom: 2,
});
const depart = etatInitial([page("d1", [emplacement("e1"), pose])]);

describe("reduireEditeur", () => {
  it("pose une photo avec un cadrage neutre", () => {
    const etat = reduireEditeur(depart, {
      type: "poser",
      emplacementId: "e1",
      photoId: "p9",
    });
    expect(emplacementDe(etat, "e1")).toMatchObject({
      photo_id: "p9",
      cadrage_x: 0.5,
      cadrage_y: 0.5,
      cadrage_zoom: 1,
    });
  });

  it("écrase l'ancien cadrage en posant une autre photo", () => {
    const etat = reduireEditeur(depart, {
      type: "poser",
      emplacementId: "e2",
      photoId: "p9",
    });
    expect(emplacementDe(etat, "e2")).toMatchObject({
      photo_id: "p9",
      cadrage_zoom: 1,
    });
  });

  it("vide un emplacement en gardant son cadrage", () => {
    const etat = reduireEditeur(depart, { type: "vider", emplacementId: "e2" });
    expect(emplacementDe(etat, "e2")).toMatchObject({
      photo_id: null,
      cadrage_x: 0.2,
      cadrage_zoom: 2,
    });
  });

  it("recadre un emplacement", () => {
    const etat = reduireEditeur(depart, {
      type: "recadrer",
      emplacementId: "e2",
      cadrage: { x: 0.4, y: 0.5, zoom: 1.5 },
    });
    expect(emplacementDe(etat, "e2")).toMatchObject({
      cadrage_x: 0.4,
      cadrage_y: 0.5,
      cadrage_zoom: 1.5,
    });
  });

  it("écrit un texte, et enregistre un texte effacé comme absent", () => {
    const ecrit = reduireEditeur(depart, {
      type: "ecrireTexte",
      emplacementId: "e1",
      contenu: documentDepuisTexte("Lisbonne"),
    });
    expect(emplacementDe(ecrit, "e1")?.contenu_texte).toEqual(
      documentDepuisTexte("Lisbonne"),
    );
    const efface = reduireEditeur(ecrit, {
      type: "ecrireTexte",
      emplacementId: "e1",
      contenu: null,
    });
    expect(emplacementDe(efface, "e1")?.contenu_texte).toBeNull();
  });

  it("rétablit un emplacement à l'identique", () => {
    const vide = reduireEditeur(depart, { type: "vider", emplacementId: "e2" });
    const etat = reduireEditeur(vide, { type: "retablir", emplacement: pose });
    expect(emplacementDe(etat, "e2")).toEqual(pose);
  });

  it("ne touche pas les autres emplacements", () => {
    const etat = reduireEditeur(depart, {
      type: "poser",
      emplacementId: "e1",
      photoId: "p9",
    });
    expect(emplacementDe(etat, "e2")).toBe(pose);
  });

  it("sélectionne puis désélectionne un emplacement", () => {
    const etat = reduireEditeur(depart, {
      type: "selectionner",
      emplacementId: "e1",
    });
    expect(etat.selection).toBe("e1");
    expect(
      reduireEditeur(etat, { type: "selectionner", emplacementId: null })
        .selection,
    ).toBeNull();
  });

  it("remplace les doubles pages et oublie une sélection disparue", () => {
    const selectionne = reduireEditeur(depart, {
      type: "selectionner",
      emplacementId: "e1",
    });
    const etat = reduireEditeur(selectionne, {
      type: "remplacerDoublesPages",
      doublesPages: [page("d2", [emplacement("e3")])],
    });
    expect(etat.doublesPages.map((d) => d.id)).toEqual(["d2"]);
    expect(etat.selection).toBeNull();
  });

  it("garde la sélection si l'emplacement existe encore", () => {
    const selectionne = reduireEditeur(depart, {
      type: "selectionner",
      emplacementId: "e1",
    });
    const etat = reduireEditeur(selectionne, {
      type: "remplacerDoublesPages",
      doublesPages: depart.doublesPages,
    });
    expect(etat.selection).toBe("e1");
  });
});
