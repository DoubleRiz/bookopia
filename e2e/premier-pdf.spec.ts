import { expect, test } from "@playwright/test";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { png } from "./images";

const MM = 72 / 25.4;

test("le Créateur compose son livre et en exporte le PDF", async ({ page }) => {
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

  await page.getByRole("button", { name: "Importer des photos" }).click();
  const fenetre = page.getByRole("dialog", { name: "Importer des photos" });
  await fenetre.getByLabel(/Glissez vos photos ici/).setInputFiles(
    [
      [200, 40, 40],
      [40, 160, 60],
      [40, 80, 200],
    ].map((couleur, rang) => ({
      name: `photo-${rang + 1}.png`,
      mimeType: "image/png",
      buffer: png(1200, 800, couleur),
    })),
  );
  await fenetre.getByRole("button", { name: "Importer 3 photos" }).click();
  await expect(
    fenetre.getByText("3 photos ajoutées à la réserve"),
  ).toBeVisible();
  await fenetre.getByRole("button", { name: "Voir la réserve" }).click();

  await page.getByRole("button", { name: "Composer le livre" }).click();
  // Le livre a des intérieures dès sa création : attendre une photo posée, pas la double page.
  await expect(
    page
      .getByRole("navigation", { name: "Doubles pages du livre" })
      .locator("image"),
  ).toHaveCount(3);

  await page.getByRole("link", { name: "Exporter le livre" }).click();
  await expect(page).toHaveURL(/\/livre\/[^/]+\/export$/);

  // Les cadres photo de la couverture et de la 4e sont vides : ils sont listés, sans bloquer.
  await expect(
    page.getByRole("heading", { name: "Cadres photo vides" }),
  ).toBeVisible();
  const vide = page.getByRole("link", { name: "Couverture", exact: true });
  await expect(vide).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Quatrième de couverture" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exporter le PDF" }),
  ).toBeEnabled();

  // Le lien ouvre l'éditeur sur la double page concernée, puis on revient.
  await vide.click();
  await expect(page).toHaveURL(/\/livre\/[^/]+\?page=/);
  await page.goBack();

  await page.getByRole("button", { name: "Exporter le PDF" }).click();
  await expect(page.getByText("PDF à jour.")).toBeVisible();
  const lien = page.getByRole("link", { name: "Télécharger le PDF" });
  await expect(lien).toBeVisible();

  const reponse = await page.request.get(
    (await lien.getAttribute("href")) ?? "",
  );
  expect(reponse.ok()).toBe(true);
  const document = await PDFDocument.load(await reponse.body());

  // Une page par double page : couverture, intérieures, 4e.
  expect(document.getPageCount()).toBeGreaterThanOrEqual(3);
  const premiere = document.getPage(0);
  expect(Math.round(premiere.getTrimBox().width / MM)).toBe(420);
  expect(Math.round(premiere.getTrimBox().height / MM)).toBe(210);

  const images = document.context
    .enumerateIndirectObjects()
    .filter(
      ([, objet]) =>
        objet instanceof PDFRawStream &&
        objet.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"),
    );
  expect(images).toHaveLength(3);
});
