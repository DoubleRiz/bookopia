import { expect, test } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { allerA, creerLivreImporte, ecrire } from "./parcours";

// BK-036 : le parcours principal d'une traite, import → édition → couverture → export. Les
// morceaux sont déjà éprouvés un à un (premier-pdf, editeur, textes-themes) ; celui-ci vérifie
// qu'ils tiennent ensemble, et que la couverture travaillée se retrouve dans le PDF.
test("le Créateur importe, compose, soigne sa couverture et exporte son livre", async ({
  page,
}) => {
  await creerLivreImporte(page, 3);
  await page.getByRole("button", { name: "Composer le livre" }).click();
  const bande = page.getByRole("navigation", {
    name: "Doubles pages du livre",
  });
  await expect(bande.locator("image")).toHaveCount(3);

  // Édition : une photo vidée, reposée depuis la réserve.
  const cadre = page
    .getByRole("group", { name: "Pages 2 et 3" })
    .getByRole("button", { name: /^Cadre 1,/ });
  await cadre.click();
  await page.getByRole("button", { name: "Vider" }).click();
  await expect(cadre).toHaveAccessibleName("Cadre 1, vide");
  await page
    .getByRole("button", { name: /^Poser « photo-1\.png »/ })
    .press("Enter");
  await expect(cadre).toHaveAccessibleName("Cadre 1, photo posée");
  await expect(page.getByRole("status")).toHaveText("Enregistré");

  // Couverture : une photo et un titre.
  await allerA(page, "Couverture");
  const couverture = page.getByRole("group", { name: "Couverture" });
  const photoCouverture = couverture.getByRole("button", { name: /^Cadre 1,/ });
  await expect(photoCouverture).toHaveAccessibleName("Cadre 1, vide");
  await photoCouverture.click();
  await page
    .getByRole("button", { name: /^Poser « photo-2\.png »/ })
    .press("Enter");
  await expect(photoCouverture).toHaveAccessibleName("Cadre 1, photo posée");
  await ecrire(page, "Titre 2", "Carnet de test");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("status")).toHaveText("Enregistré");

  // Export : la couverture n'est plus signalée vide, la 4e l'est toujours.
  await page.getByRole("link", { name: "Vérifier et exporter" }).click();
  const vides = page
    .getByRole("heading", { name: "Cadres photo vides" })
    .locator("xpath=following-sibling::ul[1]");
  await expect(
    vides.getByRole("link", { name: "Quatrième de couverture" }),
  ).toBeVisible();
  await expect(
    vides.getByRole("link", { name: "Couverture", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Exporter le PDF" }).click();
  await expect(page.getByText("PDF à jour.")).toBeVisible();
  const lien = page.getByRole("link", { name: "Télécharger le PDF" });
  const reponse = await page.request.get(
    (await lien.getAttribute("href")) ?? "",
  );
  expect(reponse.ok()).toBe(true);
  const document = await PDFDocument.load(await reponse.body());

  // Une page par double page. Une photo posée deux fois n'est embarquée qu'une fois : les trois
  // photos font trois images. Le titre de la couverture est le seul texte : une police embarquée.
  expect(document.getPageCount()).toBeGreaterThanOrEqual(3);
  const objets = document.context
    .enumerateIndirectObjects()
    .map(([, objet]) => objet);
  expect(
    objets.filter(
      (objet) =>
        objet instanceof PDFRawStream &&
        objet.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"),
    ),
  ).toHaveLength(3);
  expect(
    objets.filter(
      (objet): objet is PDFDict =>
        objet instanceof PDFDict &&
        objet.get(PDFName.of("Subtype")) === PDFName.of("Type0"),
    ),
  ).toHaveLength(1);
});
