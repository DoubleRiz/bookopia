import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { DeclarationAccessibilite } from "./DeclarationAccessibilite";

const page = renderToStaticMarkup(
  <MemoryRouter>
    <DeclarationAccessibilite />
  </MemoryRouter>,
);

// Rubriques du modèle de déclaration du RGAA. Le contenu reprend docs/audit-rgaa.md : rien
// n'y est déclaré que l'audit n'a pas établi.
describe("DeclarationAccessibilite", () => {
  it("annonce l'état de conformité et le taux mesuré par l'audit", () => {
    expect(page).toContain("partiellement conforme");
    expect(page).toContain("RGAA, version 4.1.2");
    expect(page).toContain("83,1 %");
  });

  it("liste les non-conformités relevées par l'audit", () => {
    for (const defaut of [
      "nom de fichier",
      "bordure des champs",
      "320 pixels",
      "PDF exporté",
    ]) {
      expect(page).toContain(defaut);
    }
  });

  it("dit ce qui n'a pas encore été vérifié", () => {
    expect(page).toContain("Deux critères n&#x27;ont pas encore été vérifiés");
    expect(page).toContain("lecteur d&#x27;écran");
  });

  it("donne un contact et les voies de recours", () => {
    expect(page).toContain('href="mailto:gautier.baleda@gmail.com"');
    expect(page).toContain("Défenseur des droits");
  });

  it("a un seul titre principal et un seul main", () => {
    expect(page.match(/<h1/g)).toHaveLength(1);
    expect(page.match(/<main/g)).toHaveLength(1);
  });

  it("garde le pied de page, qui mène à elle-même", () => {
    expect(page).toContain('href="/accessibilite"');
  });
});
