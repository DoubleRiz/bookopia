import { describe, expect, it } from "vitest";
import {
  cheminsSousDossier,
  confirmationValide,
  enLots,
  type EntreeDossier,
} from "./dossiers";

// Un arbre : un dossier absent de la table est vide.
function listeur(arbre: Record<string, EntreeDossier[]>) {
  return (dossier: string) => Promise.resolve(arbre[dossier] ?? []);
}
const fichier = (name: string): EntreeDossier => ({ name, id: `id-${name}` });
const dossier = (name: string): EntreeDossier => ({ name, id: null });

describe("cheminsSousDossier", () => {
  it("descend dans les sous-dossiers et rend les chemins complets des fichiers", async () => {
    const lister = listeur({
      u: [dossier("livre"), fichier("racine.jpg")],
      "u/livre": [dossier("originaux"), dossier("vignettes")],
      "u/livre/originaux": [fichier("a.jpg"), fichier("b.jpg")],
      "u/livre/vignettes": [fichier("a.webp")],
    });
    expect(await cheminsSousDossier(lister, "u")).toEqual([
      "u/livre/originaux/a.jpg",
      "u/livre/originaux/b.jpg",
      "u/livre/vignettes/a.webp",
      "u/racine.jpg",
    ]);
  });

  it("ne rend rien pour un dossier vide", async () => {
    expect(await cheminsSousDossier(listeur({}), "u")).toEqual([]);
  });
});

describe("enLots", () => {
  it("découpe sans perdre d'élément", () => {
    expect(enLots([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("ne rend aucun lot pour une liste vide", () => {
    expect(enLots([], 100)).toEqual([]);
  });
});

describe("confirmationValide", () => {
  it("n'accepte que le mot attendu, sans tenir compte des espaces ni de la casse", () => {
    expect(confirmationValide("supprimer")).toBe(true);
    expect(confirmationValide("  Supprimer ")).toBe(true);
    expect(confirmationValide("")).toBe(false);
    expect(confirmationValide("supprim")).toBe(false);
    expect(confirmationValide("supprimer mon compte")).toBe(false);
  });
});
