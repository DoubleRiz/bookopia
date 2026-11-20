import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { PiedDePage } from "../composants/PiedDePage";
import { PolitiqueConfidentialite } from "./PolitiqueConfidentialite";

const page = renderToStaticMarkup(
  <MemoryRouter>
    <PolitiqueConfidentialite />
  </MemoryRouter>,
);

// RGPD, art. 13 : identité du responsable, données, finalités, base légale, durée, destinataires,
// transferts hors UE et droits doivent être donnés à la personne au moment de la collecte.
describe("PolitiqueConfidentialite", () => {
  it("nomme le responsable du traitement et un contact", () => {
    expect(page).toContain("Gautier Baleda");
    expect(page).toContain('href="mailto:gautier.baleda@gmail.com"');
  });

  it("liste les données collectées", () => {
    expect(page).toContain("adresse e-mail");
    expect(page).toContain("mot de passe");
    expect(page).toContain("nom d&#x27;affichage");
    expect(page).toContain("photos");
    expect(page).toContain("date de prise de vue");
  });

  it("donne les finalités et les bases légales", () => {
    expect(page).toContain("Finalité");
    expect(page).toContain("exécution du service");
    expect(page).toContain("consentement");
  });

  it("indique la durée de conservation", () => {
    expect(page).toContain("Durée de conservation");
    expect(page).toContain("suppression");
  });

  it("explique ce que Google reçoit à l'import", () => {
    expect(page).toContain("Import depuis Google Photos");
    expect(page).toContain("adresse IP");
    expect(page).toContain("photospicker.mediaitems.readonly");
  });

  it("cite les destinataires, l'hébergement à Paris et les transferts hors UE", () => {
    expect(page).toContain("Supabase Pte. Ltd.");
    expect(page).toContain("Paris");
    expect(page).toContain("Vercel");
    expect(page).toContain("Singapour");
    expect(page).toContain("États-Unis");
  });

  it("affirme l'absence de traceur et de cookie publicitaire", () => {
    expect(page).toContain("aucun traceur");
  });

  it("dit comment exercer ses droits", () => {
    expect(page).toContain("Vos droits");
    expect(page).toContain("portabilité");
    expect(page).toContain("espace personnel");
  });

  it("a un seul titre principal et un seul main", () => {
    expect(page.match(/<h1/g)).toHaveLength(1);
    expect(page.match(/<main/g)).toHaveLength(1);
  });

  it("garde le pied de page, qui mène à elle-même", () => {
    expect(page).toContain('href="/politique-de-confidentialite"');
  });
});

describe("PiedDePage", () => {
  it("mène à la politique de confidentialité", () => {
    const pied = renderToStaticMarkup(
      <MemoryRouter>
        <PiedDePage />
      </MemoryRouter>,
    );
    expect(pied).toContain('href="/politique-de-confidentialite"');
    expect(pied).toContain("Politique de confidentialité");
  });
});
