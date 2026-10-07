import { expect, test } from "@playwright/test";

// Un compte neuf par exécution : le test ne dépend d'aucune donnée laissée par un autre.
test("le Créateur crée, renomme et supprime un livre", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@bookopia.test`;

  await page.goto("/inscription");
  await page.getByLabel("Votre nom").fill("Créateur de test");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("parcours-e2e-local");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page.getByText("Aucun livre pour l'instant")).toBeVisible();

  // Créer, depuis la surcouche S1.
  await page.getByRole("button", { name: "Créer mon premier livre" }).click();
  await expect(page).toHaveURL("/livres/nouveau");
  const creation = page.getByRole("dialog", { name: "Nouveau livre" });
  await creation.getByText("Raconté").click();
  await creation.getByLabel("Titre du livre").fill("Été à Lisbonne");
  await creation.getByRole("button", { name: "Créer le livre" }).click();

  await expect(page).toHaveURL("/livres");
  await expect(page.getByText("Été à Lisbonne")).toBeVisible();
  await expect(page.getByText("1 livre", { exact: true })).toBeVisible();

  // Renommer.
  await page
    .getByRole("button", { name: "Renommer « Été à Lisbonne »" })
    .click();
  const renommage = page.getByRole("dialog", { name: "Renommer le livre" });
  await renommage.getByLabel("Titre du livre").fill("Lisbonne, juillet 2026");
  await renommage.getByRole("button", { name: "Renommer" }).click();

  await expect(renommage).toBeHidden();
  await expect(page.getByText("Lisbonne, juillet 2026")).toBeVisible();

  // Supprimer.
  await page
    .getByRole("button", { name: "Supprimer « Lisbonne, juillet 2026 »" })
    .click();
  const suppression = page.getByRole("dialog", {
    name: "Supprimer « Lisbonne, juillet 2026 » ?",
  });
  await suppression.getByRole("button", { name: "Supprimer" }).click();

  await expect(page.getByText("Aucun livre pour l'instant")).toBeVisible();
});
