import { expect, test } from "@playwright/test";
import { png } from "./images";

test("le Créateur importe des photos dans la réserve de son livre", async ({
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

  await expect(page.getByText("Aucune photo pour l'instant")).toBeVisible();
  await page.getByRole("button", { name: "Importer des photos" }).click();
  await expect(page).toHaveURL(/\/livre\/[0-9a-f-]{36}\/import$/);

  const bleu = png(1200, 800, [40, 80, 200]);
  const fenetre = page.getByRole("dialog", { name: "Importer des photos" });
  await fenetre.getByLabel(/Glissez vos photos ici/).setInputFiles([
    { name: "bleu.png", mimeType: "image/png", buffer: bleu },
    { name: "copie-du-bleu.png", mimeType: "image/png", buffer: bleu },
    {
      name: "logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    },
  ]);

  await expect(fenetre.getByText("1 fichier refusé")).toBeVisible();
  await fenetre.getByRole("button", { name: "Importer 2 photos" }).click();

  await expect(fenetre.getByText("1 photo ajoutée à la réserve")).toBeVisible();
  await expect(
    fenetre.getByText("1 photo était déjà dans le livre."),
  ).toBeVisible();

  // Reprise : la même photo, choisie à nouveau, est sautée.
  await fenetre
    .getByRole("button", { name: "Importer d'autres photos" })
    .click();
  await fenetre.getByLabel(/Glissez vos photos ici/).setInputFiles([
    { name: "bleu.png", mimeType: "image/png", buffer: bleu },
    {
      name: "rouge.png",
      mimeType: "image/png",
      buffer: png(1200, 800, [200, 40, 40]),
    },
  ]);
  await fenetre.getByRole("button", { name: "Importer 2 photos" }).click();
  await expect(fenetre.getByText("1 photo ajoutée à la réserve")).toBeVisible();

  await fenetre.getByRole("button", { name: "Voir la réserve" }).click();
  await expect(page.getByText("2 photos")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "bleu.png", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "rouge.png", exact: true }),
  ).toBeVisible();
});
