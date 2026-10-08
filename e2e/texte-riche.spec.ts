import { expect, test } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import {
  allerA,
  appliquerGabarit,
  creerLivreRaconte,
  ecrire,
} from "./parcours";

test("le Créateur met son texte en forme, et le PDF suit", async ({ page }) => {
  // Ni erreur ni avertissement React pendant la saisie.
  const problemes: string[] = [];
  page.on("pageerror", (erreur) => problemes.push(erreur.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      problemes.push(message.text());
    }
  });
  await creerLivreRaconte(page);
  const pages23 = page.getByRole("group", { name: "Pages 2 et 3" });
  await appliquerGabarit(page, "Photo et bloc texte");

  const zone = await ecrire(page, "Légende 3", "Bonjour");
  const barre = page.getByRole("toolbar", { name: "Mise en forme du texte" });
  await expect(barre).toBeVisible();

  // Caveat n'a ni gras ni italique : les boutons sont grisés, rien n'est simulé.
  await expect(barre.getByRole("button", { name: "Gras" })).toBeDisabled();
  await expect(barre.getByRole("button", { name: "Italique" })).toBeDisabled();

  // Tout le texte en Great Vibes, 24 pt, centré.
  await page.keyboard.press("ControlOrMeta+A");
  await barre.getByRole("button", { name: /^Police/ }).click();
  await page.getByRole("option", { name: "Great Vibes" }).click();
  const taille = barre.getByLabel("Taille en points");
  await taille.fill("24");
  await taille.press("Enter");
  await barre.getByRole("button", { name: "Centrer" }).click();
  await barre.getByRole("button", { name: "Souligné" }).click();
  await expect(zone).toBeFocused();
  await expect(barre.getByRole("button", { name: /^Police/ })).toHaveText(
    "Great Vibes",
  );
  await page.screenshot({ path: "test-results/saisie-riche.png" });

  await page.keyboard.press("Escape");
  await expect(page.getByRole("status")).toHaveText("Enregistré");
  await page.reload();
  const texte = pages23.getByText("Bonjour");
  await expect(texte).toBeVisible();
  await expect(texte).toHaveAttribute(
    "font-family",
    "bookopia-great-vibes-400",
  );
  await page.screenshot({ path: "test-results/rendu-riche.png" });

  // Le PDF intègre Great Vibes pour ce passage.
  await page.getByRole("link", { name: "Vérifier et exporter" }).click();
  await page.getByRole("button", { name: "Exporter le PDF" }).click();
  const lien = page.getByRole("link", { name: "Télécharger le PDF" });
  await expect(lien).toBeVisible();
  const reponse = await page.request.get(
    (await lien.getAttribute("href")) ?? "",
  );
  const document = await PDFDocument.load(await reponse.body());
  const polices = document.context
    .enumerateIndirectObjects()
    .map(([, objet]) => objet)
    .filter(
      (objet): objet is PDFDict =>
        objet instanceof PDFDict &&
        objet.get(PDFName.of("Subtype")) === PDFName.of("Type0"),
    )
    .map((police) => police.get(PDFName.of("BaseFont"))?.toString() ?? "");
  expect(polices.some((nom) => nom.includes("GreatVibes"))).toBe(true);
  expect(problemes).toEqual([]);
});

test("le Créateur déplace et redimensionne un cadre texte", async ({
  page,
}) => {
  await creerLivreRaconte(page);
  await appliquerGabarit(page, "Photo et bloc texte");
  await allerA(page, "Pages 2 et 3");
  const cadre = page.getByRole("button", { name: /^Légende 3,/ });
  const x0 = Number(await cadre.getAttribute("x"));
  const largeur0 = Number(await cadre.getAttribute("width"));

  // Un clic sélectionne : 8 poignées, et les flèches déplacent d'un pas de 2 mm.
  await cadre.click();
  await expect(page.locator("[data-poignee]")).toHaveCount(8);
  await page.keyboard.press("ArrowRight");
  await expect(cadre).toHaveAttribute("x", String(x0 + 2));
  await expect(page.getByRole("status")).toHaveText("Enregistré");

  // Maj + flèche élargit.
  await page.keyboard.press("Shift+ArrowRight");
  await expect(cadre).toHaveAttribute("width", String(largeur0 + 2));
  await expect(page.getByRole("status")).toHaveText("Enregistré");

  // Une poignée tirée à la souris : le bord est glissé, le cadre reste dans les marges.
  const poignee = page.locator("[data-poignee=e]");
  const boite = await poignee.boundingBox();
  if (!boite) throw new Error("poignée introuvable");
  await page.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2);
  await page.mouse.down();
  await page.mouse.move(boite.x - 60, boite.y + boite.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Enregistré");
  expect(Number(await cadre.getAttribute("width"))).toBeLessThan(largeur0);

  // Annuler défait le dernier geste, et le résultat survit au rechargement.
  const rogne = Number(await cadre.getAttribute("width"));
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("status")).toHaveText("Enregistré");
  const restaure = await cadre.getAttribute("width");
  expect(Number(restaure)).toBeGreaterThan(rogne);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Légende 3,/ }),
  ).toHaveAttribute("width", restaure ?? "");
});
