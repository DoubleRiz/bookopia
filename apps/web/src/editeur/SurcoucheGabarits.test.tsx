import type { DefinitionGabarit, GabaritAComposer } from "@bookopia/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DoublePageDuLivre } from "../api/doublesPages";
import { SurcoucheGabarits } from "./SurcoucheGabarits";

const gabarit = (
  id: string,
  nom: string,
  natures: ("photo" | "texte")[],
): GabaritAComposer => ({
  id,
  nom,
  definition: natures.map((nature, indice) => ({
    indice,
    nature,
    x: 0,
    y: 0,
    largeur: 100,
    hauteur: 50,
  })) as DefinitionGabarit,
});

const gabarits = [
  gabarit("b1", "Pleine double page", ["photo"]),
  gabarit("b2", "Pleine page et blanc", ["photo"]),
  gabarit("b3", "Deux pleines pages", ["photo", "photo"]),
];

function rendre(gabaritActuel: string | null) {
  const courante: DoublePageDuLivre = {
    id: "d1",
    role: "interieur",
    position: 2,
    gabarit_origine_id: gabaritActuel,
    emplacement: [],
  };
  return renderToStaticMarkup(
    <SurcoucheGabarits
      gabarits={gabarits}
      courante={courante}
      fond="#FAF7F2"
      surChoisir={() => {}}
      surFermer={() => {}}
    />,
  );
}

// Les boutons des cartes, dans l'ordre : [libellé accessible, désactivé].
function cartes(html: string): [string, boolean][] {
  return [...html.matchAll(/<button([^>]*)>/g)]
    .map(([, attributs]) => attributs ?? "")
    .filter((attributs) => attributs.includes("aria-label"))
    .map((attributs): [string, boolean] => [
      /aria-label="([^"]*)"/.exec(attributs)?.[1] ?? "",
      attributs.includes("disabled"),
    ]);
}

describe("SurcoucheGabarits", () => {
  it("montre une carte par gabarit de la famille, dans l'ordre du catalogue", () => {
    expect(cartes(rendre("b1")).map(([libelle]) => libelle)).toEqual([
      "Pleine double page, 1 photo, gabarit actuel",
      "Pleine page et blanc, 1 photo",
      "Deux pleines pages, 2 photos",
    ]);
  });

  it("ne laisse pas choisir le gabarit actuel", () => {
    expect(cartes(rendre("b1")).map(([, desactive]) => desactive)).toEqual([
      true,
      false,
      false,
    ]);
    expect(rendre("b1")).toContain("Actuel");
  });

  it("laisse tout choisir quand le gabarit d'origine est inconnu", () => {
    const html = rendre(null);
    expect(cartes(html).every(([, desactive]) => !desactive)).toBe(true);
    expect(html).not.toContain("Actuel");
  });
});
