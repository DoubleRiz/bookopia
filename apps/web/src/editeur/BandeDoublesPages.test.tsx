import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DoublePageDuLivre } from "../api/doublesPages";
import { BandeDoublesPages } from "./BandeDoublesPages";

const page = (
  id: string,
  role: DoublePageDuLivre["role"],
  position: number | null,
): DoublePageDuLivre => ({
  id,
  role,
  position,
  gabarit_origine_id: null,
  emplacement: [],
});

const couverture = page("c", "couverture", null);
const quatrieme = page("q", "quatrieme", null);
const premiere = page("i1", "interieur", 1);
const interieures = [premiere, page("i2", "interieur", 2)];

function rendre(courante: DoublePageDuLivre) {
  return renderToStaticMarkup(
    <BandeDoublesPages
      couverture={couverture}
      quatrieme={quatrieme}
      interieures={interieures}
      courante={courante}
      habillage={{
        theme: {
          palette: { fond: "#FAF7F2", texte: "#3E3856" },
          bordure_cadre: null,
          typographie: {
            titre: {
              police: "Nunito",
              graisse: 800,
              italique: false,
              taille_pt: 18,
            },
            legende: {
              police: "Nunito",
              graisse: 400,
              italique: false,
              taille_pt: 9,
            },
            alignement: "gauche",
            ancrage: "haut",
            styles_masques: [],
          },
        },
        mesures: null,
      }}
      photos={new Map()}
      actif
      peutAjouter
      peutChangerGabarit
      surChoisir={() => {}}
      surAjouter={() => {}}
      surDeplacer={() => {}}
      surChangerGabarit={() => {}}
      surDupliquer={() => {}}
      surSupprimer={() => {}}
    />,
  );
}

// Le libellé de la bande, puis celui de chaque élément qui se choisit : les dessins n'en comptent pas.
const libelles = (html: string) =>
  [...html.matchAll(/<(?:nav|button|div)\b([^>]*)>/g)]
    .map(([, attributs = ""]) => attributs)
    .map((attributs) => /aria-label="([^"]*)"/.exec(attributs)?.[1])
    .filter(Boolean);

describe("BandeDoublesPages", () => {
  it("montre la couverture, les intérieures puis la 4e, le « + » avant la 4e", () => {
    expect(libelles(rendre(premiere))).toEqual([
      "Doubles pages du livre",
      "Couverture",
      "Pages 2 et 3",
      "Pages 4 et 5",
      "Ajouter une double page après la page courante",
      "Quatrième de couverture",
    ]);
  });

  it("n'offre que les gestes d'une intérieure sur une intérieure", () => {
    const html = rendre(premiere);
    expect(html).toContain("Déplacer à gauche");
    expect(html).toContain("Supprimer");
  });

  it.each([couverture, quatrieme])(
    "ne propose ni déplacer, ni dupliquer, ni supprimer sur $role",
    (courante) => {
      const html = rendre(courante);
      expect(html).not.toContain("Déplacer");
      expect(html).not.toContain("Dupliquer");
      expect(html).not.toContain("Supprimer");
      expect(html).not.toContain("Changer le gabarit");
    },
  );

  it("ne laisse glisser que les intérieures", () => {
    const html = rendre(couverture);
    expect(html.match(/draggable="true"/g)).toHaveLength(2);
  });
});
