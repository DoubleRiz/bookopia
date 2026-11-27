import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { PlanDuSite } from "./PlanDuSite";

const page = renderToStaticMarkup(
  <MemoryRouter>
    <PlanDuSite />
  </MemoryRouter>,
);

// RGAA 12.1 : le plan du site est le deuxième système de navigation, à côté du menu.
describe("PlanDuSite", () => {
  it.each([
    "/",
    "/connexion",
    "/inscription",
    "/livres",
    "/livres/nouveau",
    "/mentions-legales",
    "/politique-de-confidentialite",
    "/accessibilite",
  ])("mène à %s", (adresse) => {
    expect(page).toContain(`href="${adresse}"`);
  });

  it("a un seul titre principal et un seul main", () => {
    expect(page.match(/<h1/g)).toHaveLength(1);
    expect(page.match(/<main/g)).toHaveLength(1);
  });
});
