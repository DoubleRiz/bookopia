import { expect, test } from "@playwright/test";

// BK-134 : information RGPD, exigée aussi par Google pour l'import. La page est publique,
// et le pied de l'accueil y mène.
test("le Visiteur lit la politique de confidentialité depuis le pied de l'accueil", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Informations légales" })
    .getByRole("link", { name: "Politique de confidentialité" })
    .click();

  await expect(page).toHaveURL(/\/politique-de-confidentialite$/);
  await expect(page).toHaveTitle(/Politique de confidentialité/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Politique de confidentialité",
    }),
  ).toBeFocused();
  for (const rubrique of [
    "Données collectées",
    "Finalité et base légale",
    "Import depuis Google Photos",
    "Durée de conservation",
    "Vos droits",
  ]) {
    await expect(
      page.getByRole("heading", { level: 2, name: rubrique }),
    ).toBeVisible();
  }
});

test("la page s'ouvre directement, sans compte", async ({ page }) => {
  await page.goto("/politique-de-confidentialite");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Politique de confidentialité",
    }),
  ).toBeVisible();
});
