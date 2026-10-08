import { expect, type Page } from "@playwright/test";
import { png } from "./images";

// Un livre « Raconté » (thème Carnet) avec une photo, sans composition : ses intérieures gardent
// les gabarits choisis à la création, et on applique ceux qui portent des textes.
export async function creerLivreRaconte(page: Page) {
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

export const bande = (page: Page) =>
  page.getByRole("navigation", { name: "Doubles pages du livre" });

export async function allerA(page: Page, pages: string) {
  const miniature = bande(page).getByRole("button", {
    name: pages,
    exact: true,
  });
  await miniature.click();
  await expect(miniature).toHaveAttribute("aria-current", "page");
}

// Applique un gabarit à la double page courante, s'il ne l'est pas déjà. Les pages sont vides :
// aucun avertissement.
export async function appliquerGabarit(page: Page, nom: string) {
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
export async function ecrire(page: Page, cadre: string, texte: string) {
  const cible = page.getByRole("button", { name: new RegExp(`^${cadre},`) });
  await cible.click();
  await cible.click();
  const zone = page.getByRole("textbox", { name: cadre });
  await expect(zone).toBeFocused();
  await page.keyboard.type(texte);
  return zone;
}
