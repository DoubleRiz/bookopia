import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { MentionsLegales } from "./MentionsLegales";

const page = renderToStaticMarkup(
  <MemoryRouter>
    <MentionsLegales />
  </MemoryRouter>,
);

// LCEN, art. 6 : l'éditeur, l'hébergeur et un moyen de contact doivent figurer sur le site.
describe("MentionsLegales", () => {
  it("indique l'éditeur et un contact", () => {
    expect(page).toContain("Gautier Baleda");
    expect(page).toContain('href="mailto:gautier.baleda@gmail.com"');
  });

  it("indique l'hébergeur du site et celui des données", () => {
    expect(page).toContain("Vercel Inc.");
    expect(page).toContain("Supabase Pte. Ltd.");
  });

  it("a un seul titre principal et un seul main", () => {
    expect(page.match(/<h1/g)).toHaveLength(1);
    expect(page.match(/<main/g)).toHaveLength(1);
  });

  it("garde le pied de page, qui mène à elle-même", () => {
    expect(page).toContain('href="/mentions-legales"');
  });
});
