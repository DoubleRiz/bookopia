import { expect, test } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { allerA, bande, creerLivreImporte, ecrire } from "./parcours";

// BK-036 : le parcours principal d'une traite, import → édition → couverture → export. Les
// morceaux sont déjà éprouvés un à un (premier-pdf, editeur, textes-themes) ; celui-ci vérifie
// qu'ils tiennent ensemble : la couverture n'est plus signalée vide, le PDF a ses pages, ses photos
// et la police de son titre.
test("le Créateur importe, compose, soigne sa couverture et exporte son livre", async ({
  page,
}) => {
  await creerLivreImporte(page, 3);
  await page.getByRole("button", { name: "Composer le livre" }).click();
  await expect(bande(page).locator("image")).toHaveCount(3);

  // Édition : un recadrage (il ne change pas les photos posées, donc le compte du PDF reste exact).
  await page
    .getByRole("group", { name: "Pages 2 et 3" })
    .getByRole("button", { name: /^Cadre 1,/ })
    .click();
  await page.getByRole("button", { name: "Recadrer" }).click();
  const recadrage = page.getByRole("dialog", { name: "Recadrer la photo" });
  await recadrage.getByLabel("Zoom").fill("2");
  await recadrage.getByRole("button", { name: "Valider" }).click();
  await expect(recadrage).toBeHidden();
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

  // Une page par double page : couverture, 4e et trois intérieures. Une photo posée deux fois
  // n'est embarquée qu'une fois : les trois photos font trois images. Le titre de la couverture
  // est le seul texte du livre : une seule police embarquée.
  expect(document.getPageCount()).toBe(5);
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
