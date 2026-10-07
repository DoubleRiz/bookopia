import { expect, type Page, test } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { png } from "./images";

// Un livre « Raconté » (thème Carnet) avec une photo, sans composition : ses intérieures gardent
// les gabarits choisis à la création, et on applique ceux qui portent des textes.
async function creerLivreRaconte(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@bookopia.test`;
  await page.goto("/inscription");
  await page.getByLabel("Votre nom").fill("Créateur de test");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("parcours-e2e-local");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await page.getByRole("button", { name: "Créer mon premier livre" }).click();
  const creation = page.getByRole("dialog", { name: "Nouveau livre" });
  await creation.getByText("Raconté").click();
  await creation.getByLabel("Titre du livre").fill("Bretagne");
  await creation.getByRole("button", { name: "Créer le livre" }).click();

  await page.getByRole("button", { name: "Importer des photos" }).click();
  const fenetre = page.getByRole("dialog", { name: "Importer des photos" });
  await fenetre.getByLabel(/Glissez vos photos ici/).setInputFiles({
    name: "phare.png",
    mimeType: "image/png",
    buffer: png(1200, 800, [40, 80, 200]),
  });
  await fenetre.getByRole("button", { name: "Importer 1 photo" }).click();
  await expect(fenetre.getByText("1 photo ajoutée à la réserve")).toBeVisible();
  await fenetre.getByRole("button", { name: "Voir la réserve" }).click();
}

const bande = (page: Page) =>
  page.getByRole("navigation", { name: "Doubles pages intérieures" });

async function allerA(page: Page, pages: string) {
  const miniature = bande(page).getByRole("button", { name: pages });
  await miniature.click();
  await expect(miniature).toHaveAttribute("aria-current", "page");
}

// Applique un gabarit à la double page courante, s'il ne l'est pas déjà. Les pages sont vides :
// aucun avertissement.
async function appliquerGabarit(page: Page, nom: string) {
  await bande(page).getByRole("button", { name: "Changer le gabarit" }).click();
  const choix = page.getByRole("dialog", { name: "Changer le gabarit" });
  const carte = choix.getByRole("button", { name: new RegExp(`^${nom}`) });
  if (await carte.isDisabled()) {
    await page.keyboard.press("Escape");
  } else {
    await carte.click();
  }
  await expect(choix).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("Enregistré");
}

// Un clic sélectionne le cadre, le second ouvre la saisie.
async function ecrire(page: Page, cadre: string, texte: string) {
  const cible = page.getByRole("button", { name: new RegExp(`^${cadre},`) });
  await cible.click();
  await cible.click();
  const zone = page.getByRole("textbox", { name: cadre });
  await expect(zone).toBeFocused();
  await page.keyboard.type(texte);
  return zone;
}

async function changerTheme(page: Page, actuel: string, nom: string) {
  await page.getByRole("button", { name: `Thème · ${actuel}` }).click();
  const choix = page.getByRole("dialog", { name: "Changer le thème" });
  await choix.getByRole("button", { name: new RegExp(`^${nom}`) }).click();
  await expect(choix).toBeHidden();
  await expect(
    page.getByRole("button", { name: `Thème · ${nom}` }),
  ).toBeVisible();
}

test("le Créateur écrit ses légendes et change le thème du livre", async ({
  page,
}) => {
  await creerLivreRaconte(page);
  const pages23 = page.getByRole("group", { name: "Pages 2 et 3" });
  const pages45 = page.getByRole("group", { name: "Pages 4 et 5" });

  // Pages 2 et 3 : trois légendes. Le texte écrit est enregistré et survit au rechargement.
  await appliquerGabarit(page, "Trio et légendes");
  await ecrire(page, "Légende 4", "Le phare au matin");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("status")).toHaveText("Enregistré");
  await page.reload();
  await expect(pages23.getByText("Le phare au matin")).toBeVisible();

  // Le cadre plein refuse la suite : Carnet, Caveat 15 pt, deux lignes dans 14 mm.
  const zone = await ecrire(page, "Légende 5", "La marée monte ".repeat(12));
  await expect(page.getByText("Le cadre est plein")).toBeVisible();
  const ecrit = await zone.inputValue();
  expect(ecrit.length).toBeGreaterThan(10);
  expect(ecrit.length).toBeLessThan("La marée monte ".repeat(12).length);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("status")).toHaveText("Enregistré");

  // Pages 4 et 5 : la page de titre. Le changement de page repasse par le loader : on l'attend.
  await allerA(page, "Pages 4 et 5");
  await appliquerGabarit(page, "Page de titre");
  await ecrire(page, "Titre 2", "Ouessant");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("status")).toHaveText("Enregistré");

  // Silence masque les légendes et garde le titre de la page de titre. Rien n'est perdu.
  await changerTheme(page, "Carnet", "Silence");
  await expect(pages45.getByText("Ouessant")).toBeVisible();
  await allerA(page, "Pages 2 et 3");
  await expect(pages23.getByText("Le phare au matin")).toBeHidden();
  await expect(pages23.getByText("Masqué par le thème")).toHaveCount(3);

  await changerTheme(page, "Silence", "Classique");
  await expect(pages23.getByText("Le phare au matin")).toBeVisible();

  // Le PDF intègre les polices du thème : EB Garamond pour le titre et les légendes.
  await page.getByRole("button", { name: "Exporter le PDF" }).click();
  const lien = page.getByRole("link", { name: "Télécharger le PDF" });
  await expect(lien).toBeVisible();
  const reponse = await page.request.get(
    (await lien.getAttribute("href")) ?? "",
  );
  expect(reponse.ok()).toBe(true);
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
  expect(polices).toHaveLength(2);
  expect(polices.every((nom) => nom.includes("EBGaramond"))).toBe(true);
});
