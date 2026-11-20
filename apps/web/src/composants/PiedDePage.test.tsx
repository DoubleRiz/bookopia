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
  expect(html).toContain('aria-label="Informations légales"');
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
