import { expect, test } from "@playwright/test";
import { png } from "./images";

test("le Créateur supprime une photo de la réserve, puis la réimporte", async ({
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

  const vert = png(1200, 800, [40, 160, 80]);
  const importer = async () => {
    await page.getByRole("button", { name: "Importer des photos" }).click();
    const fenetre = page.getByRole("dialog", { name: "Importer des photos" });
    await fenetre
      .getByLabel(/Glissez vos photos ici/)
      .setInputFiles([
        { name: "vert.png", mimeType: "image/png", buffer: vert },
      ]);
    await fenetre.getByRole("button", { name: "Importer 1 photo" }).click();
    await expect(
      fenetre.getByText("1 photo ajoutée à la réserve"),
    ).toBeVisible();
    await fenetre.getByRole("button", { name: "Voir la réserve" }).click();
    await expect(page.getByRole("img", { name: "vert.png" })).toBeVisible();
  };

  await importer();

  // Annuler ne supprime rien.
  await page.getByRole("button", { name: "Supprimer « vert.png »" }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Supprimer « vert.png » ?",
  });
  await confirmation.getByRole("button", { name: "Annuler" }).click();
  await expect(confirmation).toBeHidden();
  await expect(page.getByRole("img", { name: "vert.png" })).toBeVisible();

  await page.getByRole("button", { name: "Supprimer « vert.png »" }).click();
  await confirmation.getByRole("button", { name: "Supprimer" }).click();
  await expect(confirmation).toBeHidden();
  await expect(page.getByText("Aucune photo pour l'instant")).toBeVisible();

  // L'empreinte est libre : la même photo n'est plus un doublon.
  await importer();
});
