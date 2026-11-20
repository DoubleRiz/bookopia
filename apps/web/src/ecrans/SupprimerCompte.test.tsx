import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { ModaleSupprimerCompte } from "./SupprimerCompte";

// Le client Supabase exige des variables d'environnement : le rendu n'en a pas besoin.
vi.mock("../api/compte", () => ({ supprimerCompte: vi.fn() }));

// La confirmation est obligatoire : tant que le mot n'est pas tapé, le bouton destructif est inactif.
it("ouvre la modale avec le bouton de suppression inactif et le mot à taper", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <ModaleSupprimerCompte onFermer={() => undefined} />
    </MemoryRouter>,
  );
  expect(html).toContain("Supprimer mon compte ?");
  expect(html).toContain("tapez « supprimer »");
  expect(html).toMatch(
    /<button[^>]*disabled=""[^>]*>[^<]*Supprimer mon compte/,
  );
});
