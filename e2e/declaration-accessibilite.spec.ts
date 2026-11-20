import { expect, test } from "@playwright/test";

// BK-131 : la déclaration d'accessibilité est publique, et le pied de page y mène en annonçant
// l'état de conformité (RGAA).
test("le Visiteur lit la déclaration d'accessibilité depuis le pied de l'accueil", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Informations légales" })
    .getByRole("link", { name: "Accessibilité : partiellement conforme" })
    .click();

  await expect(page).toHaveURL(/\/accessibilite$/);
  await expect(page).toHaveTitle(/Déclaration d'accessibilité/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Déclaration d'accessibilité",
    }),
  ).toBeFocused();
  for (const rubrique of [
    "État de conformité",
    "Résultats des tests",
    "Contenus non accessibles",
    "Établissement de cette déclaration",
    "Retour d'information et contact",
    "Voies de recours",
  ]) {
    await expect(
      page.getByRole("heading", { level: 2, name: rubrique }),
    ).toBeVisible();
  }
});

// L'engagement « Accessible » de l'accueil renvoie au résultat réel de l'audit.
test("l'engagement d'accessibilité de l'accueil mène à la déclaration", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Lire la déclaration d'accessibilité" })
    .click();
  await expect(page).toHaveURL(/\/accessibilite$/);
});

test("la page s'ouvre directement, sans compte", async ({ page }) => {
  await page.goto("/accessibilite");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Déclaration d'accessibilité",
    }),
  ).toBeVisible();
});
