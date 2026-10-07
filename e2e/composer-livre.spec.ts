import { expect, test } from "@playwright/test";
import { png } from "./images";

test("le Créateur compose son livre, puis le recompose après confirmation", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@bookopia.test`;

  await page.goto("/inscription");
  await page.getByLabel("Votre nom").fill("Créateur de test");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("parcours-e2e-local");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await page.getByRole("button", { name: "Créer mon premier livre" }).click();
  const creation = page.getByRole("dialog", { name: "Nouveau livre" });
  await creation.getByLabel("Titre du livre").fill("Vacances");
  await creation.getByRole("button", { name: "Créer le livre" }).click();

  // Réserve vide : rien à composer. Le livre a déjà les intérieures de son modèle.
  const composer = page.getByRole("button", { name: "Composer le livre" });
  await expect(composer).toBeDisabled();
  const bande = page.getByRole("navigation", {
    name: "Doubles pages intérieures",
  });
  await expect(
    bande.getByRole("button", { name: "Pages 2 et 3" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Importer des photos" }).click();
  const fenetre = page.getByRole("dialog", { name: "Importer des photos" });
  await fenetre.getByLabel(/Glissez vos photos ici/).setInputFiles(
    [
      [200, 40, 40],
      [40, 160, 60],
      [40, 80, 200],
      [220, 180, 40],
    ].map((couleur, rang) => ({
      name: `photo-${rang + 1}.png`,
      mimeType: "image/png",
      // Deux paysages, deux portraits.
      buffer:
        rang % 2 === 0 ? png(1200, 800, couleur) : png(800, 1200, couleur),
    })),
  );
  await fenetre.getByRole("button", { name: "Importer 4 photos" }).click();
  await expect(
    fenetre.getByText("4 photos ajoutées à la réserve"),
  ).toBeVisible();
  await fenetre.getByRole("button", { name: "Voir la réserve" }).click();

  // Livre neuf, aucune photo posée : composition sans confirmation.
  await composer.click();
  const premiere = bande.getByRole("button", { name: "Pages 2 et 3" });
  await expect(premiere).toBeVisible();
  // Chaque intérieure a sa miniature : les photos posées s'y comptent une fois chacune.
  const posees = bande.locator("image");
  await expect(posees).toHaveCount(4);
  await expect(posees.first()).toHaveAttribute("href", /^http/);

  // Des photos sont posées : recomposer demande confirmation, Annuler a le focus.
  await composer.click();
  const confirmation = page.getByRole("dialog", {
    name: "Recomposer le livre ?",
  });
  await expect(
    confirmation.getByRole("button", { name: "Annuler" }),
  ).toBeFocused();
  await confirmation.getByRole("button", { name: "Recomposer" }).click();
  await expect(confirmation).toBeHidden();
  await expect(posees).toHaveCount(4);
  await expect(premiere).toBeVisible();
});
