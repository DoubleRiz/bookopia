import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import { PiedDePage } from "./PiedDePage";

it("mène aux mentions légales par une navigation nommée", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <PiedDePage />
    </MemoryRouter>,
  );
  expect(html).toContain('aria-label="Informations sur le site"');
  expect(html).toContain('href="/mentions-legales"');
  expect(html).toContain("Mentions légales");
});

// RGAA : l'état de conformité figure dans le lien vers la déclaration.
it("mène à la déclaration d'accessibilité en annonçant l'état de conformité", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <PiedDePage />
    </MemoryRouter>,
  );
  expect(html).toContain('href="/accessibilite"');
  expect(html).toContain("Accessibilité : partiellement conforme");
});

// RGAA 12.1 : le plan du site, deuxième système de navigation, est atteint depuis chaque page.
it("mène au plan du site", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <PiedDePage />
    </MemoryRouter>,
  );
  expect(html).toContain('href="/plan-du-site"');
  expect(html).toContain("Plan du site");
});
