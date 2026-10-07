import { describe, expect, it } from "vitest";
import { choisirGabaritsInterieurs } from "./choix-gabarits";

const gabarit = (
  id: string,
  nom: string,
  role: "couverture" | "interieur" | "quatrieme" = "interieur",
  famille = "genereux",
  actif = true,
) => ({ id, nom, role, famille, actif });

const modele = { famille: "genereux", nombre_doubles_pages_depart: 5 };

describe("choisirGabaritsInterieurs", () => {
  it("renvoie autant de gabarits que de doubles pages de départ", () => {
    const gabarits = [gabarit("a", "A"), gabarit("b", "B")];
    expect(choisirGabaritsInterieurs(gabarits, modele)).toHaveLength(5);
  });

  it("fait tourner les gabarits dans l'ordre de leur nom", () => {
    const gabarits = [gabarit("c", "C"), gabarit("a", "A"), gabarit("b", "B")];
    expect(choisirGabaritsInterieurs(gabarits, modele)).toEqual([
      "a",
      "b",
      "c",
      "a",
      "b",
    ]);
  });

  it("écarte les autres rôles, les autres familles et les gabarits inactifs", () => {
    const gabarits = [
      gabarit("couv", "A", "couverture"),
      gabarit("autre", "A", "interieur", "rythme"),
      gabarit("retire", "A", "interieur", "genereux", false),
      gabarit("garde", "Z"),
    ];
    expect(choisirGabaritsInterieurs(gabarits, modele)).toEqual([
      "garde",
      "garde",
      "garde",
      "garde",
      "garde",
    ]);
  });

  it("renvoie une liste vide si aucun gabarit ne convient", () => {
    expect(
      choisirGabaritsInterieurs([gabarit("x", "X", "couverture")], modele),
    ).toEqual([]);
  });
});
