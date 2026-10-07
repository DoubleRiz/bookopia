import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { VueExport } from "./VueExport";

type Props = Parameters<typeof VueExport>[0];

const BASE: Props = {
  projet: { id: "p1", titre: "Vacances" },
  controle: { faibles: [], vides: [] },
  vignettes: {},
  nombrePages: 28,
  libelles: { d1: "Couverture", d2: "Pages 2 et 3" },
  etat: "demande",
  etape: null,
  message: null,
  urlDuPdf: null,
  pdf: null,
  aJour: false,
  surExporter: () => undefined,
};

function rendre(autres: Partial<Props>): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <VueExport {...BASE} {...autres} />
    </MemoryRouter>,
  );
}

describe("VueExport", () => {
  it("dit quand il n'y a rien à vérifier", () => {
    expect(rendre({})).toContain("Aucun point à vérifier");
  });

  it("liste les cadres faibles avec un lien vers la double page", () => {
    const html = rendre({
      controle: {
        faibles: [{ double_page_id: "d2", emplacement_id: "e1", dpi: 101.6 }],
        vides: [],
      },
    });
    expect(html).toContain("Cadres sous 150 DPI");
    expect(html).toContain('href="/livre/p1?page=d2"');
    expect(html).toContain("Pages 2 et 3");
    expect(html).toContain("102 DPI");
  });

  it("liste les cadres photo vides avec un lien vers la double page", () => {
    const html = rendre({
      controle: {
        faibles: [],
        vides: [{ double_page_id: "d1", emplacement_id: "e1" }],
      },
    });
    expect(html).toContain("Cadres photo vides");
    expect(html).toContain('href="/livre/p1?page=d1"');
    expect(html).toContain("Couverture");
  });

  it("n'empêche jamais d'exporter, même avec des points à vérifier", () => {
    const html = rendre({
      controle: {
        faibles: [{ double_page_id: "d1", emplacement_id: "e1", dpi: 90 }],
        vides: [{ double_page_id: "d2", emplacement_id: "e2" }],
      },
    });
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Exporter le PDF/);
  });

  it("demandé : jamais exporté, pas de lien de téléchargement", () => {
    const html = rendre({ etat: "demande" });
    expect(html).toContain("pas encore été exporté");
    expect(html).toContain("Exporter le PDF");
    expect(html).not.toContain("Télécharger le PDF");
  });

  it("en cours : montre l'étape et désactive le bouton", () => {
    const html = rendre({
      etat: "en_cours",
      etape: { nom: "telechargement", faits: 2, total: 5 },
    });
    expect(html).toContain("Téléchargement des photos 2 sur 5");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("en cours avec un ancien PDF : l'ancien reste téléchargeable", () => {
    const html = rendre({
      etat: "en_cours",
      etape: { nom: "composition" },
      urlDuPdf: "http://pdf/ancien",
      aJour: true,
    });
    expect(html).toContain("Composition du PDF");
    expect(html).toContain('href="http://pdf/ancien"');
    expect(html).toContain("Télécharger le PDF");
  });

  it("disponible et à jour", () => {
    const html = rendre({
      etat: "disponible",
      urlDuPdf: "http://pdf/1",
      aJour: true,
    });
    expect(html).toContain("PDF à jour");
    expect(html).toContain("Relancer le rendu");
    expect(html).toContain('href="http://pdf/1"');
  });

  it("disponible mais le livre a changé depuis", () => {
    const html = rendre({
      etat: "disponible",
      urlDuPdf: "http://pdf/1",
      aJour: false,
    });
    expect(html).toContain("Le livre a changé depuis ce PDF");
    expect(html).not.toContain("pas encore été exporté");
  });

  it("échec : message, et l'ancien PDF reste téléchargeable", () => {
    const html = rendre({
      etat: "echec",
      message: "Le serveur ne répond pas.",
      urlDuPdf: "http://pdf/ancien",
      aJour: false,
    });
    expect(html).toContain("Le serveur ne répond pas.");
    expect(html).toContain('href="http://pdf/ancien"');
    expect(html).toContain("Relancer le rendu");
  });

  it("échec sans ancien PDF : propose de réessayer", () => {
    const html = rendre({ etat: "echec", message: "L'export a échoué." });
    expect(html).toContain("L&#x27;export a échoué.");
    expect(html).toContain("Exporter le PDF");
    expect(html).not.toContain("Télécharger le PDF");
  });

  it("en cours : une barre de progression qui suit les photos téléchargées", () => {
    const html = rendre({
      etat: "en_cours",
      etape: { nom: "telechargement", faits: 20, total: 40 },
    });
    expect(html).toMatch(/<progress[^>]*max="100"[^>]*value="38"/);
  });

  it("annonce le format et le nombre de pages", () => {
    expect(rendre({ nombrePages: 28 })).toContain("21 × 21 cm · 28 pages");
  });

  it("disponible : nom, taille et date du PDF", () => {
    const html = rendre({
      etat: "disponible",
      urlDuPdf: "http://pdf/1",
      pdf: { creeLe: "2026-10-02T09:14:00Z", taille: 214_000_000 },
      aJour: true,
    });
    expect(html).toContain("Vacances.pdf");
    expect(html).toContain("214 Mo");
    expect(html).toContain("Rendu le");
  });

  it("montre la vignette du cadre faible, et un cadre vide en pointillés", () => {
    const html = rendre({
      controle: {
        faibles: [{ double_page_id: "d2", emplacement_id: "e1", dpi: 120 }],
        vides: [{ double_page_id: "d1", emplacement_id: "e2" }],
      },
      vignettes: { e1: "http://vignette/e1" },
    });
    expect(html).toContain('src="http://vignette/e1"');
    expect(html).toContain("2 points à vérifier");
  });
});
