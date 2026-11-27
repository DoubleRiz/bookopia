import { expect, type Locator, test } from "@playwright/test";
import {
  appliquerGabarit,
  bande,
  creerLivreRaconte,
  ecrire,
  MOT_DE_PASSE,
} from "./parcours";

// BK-135 : corrections RGAA de l'éditeur, rejouées dans le navigateur (docs/audit-rgaa.md).

test("7.3 : Échap ferme la saisie et rend le focus au cadre texte", async ({
  page,
}) => {
  await creerLivreRaconte(page);
  await appliquerGabarit(page, "Trio et légendes");

  await ecrire(page, "Légende 4", "Le phare");
  await page.keyboard.press("Escape");

  await expect(page.getByRole("textbox", { name: "Légende 4" })).toBeHidden();
  await expect(
    page.getByRole("button", { name: /^Légende 4, écrit/ }),
  ).toBeFocused();
});

test("10.7 : la miniature de la double page courante montre l'anneau de focus", async ({
  page,
}) => {
  await creerLivreRaconte(page);
  const courante = bande(page).getByRole("button", {
    name: "Pages 2 et 3",
    exact: true,
  });
  await courante.click();
  await expect(courante).toHaveAttribute("aria-current", "page");

  // Focus clavier : on part de la miniature voisine et on revient à la courante.
  await bande(page)
    .getByRole("button", { name: "Pages 4 et 5", exact: true })
    .focus();
  await page.keyboard.press("Shift+Tab");
  await expect(courante).toBeFocused();

  // L'anneau (2 px blanc, 2 px lavande soutenu) s'ajoute au halo de la page courante.
  const ombre = await courante.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ombre).toContain("rgb(123, 82, 184) 0px 0px 0px 4px");
});

// Le bouton du gabarit flotte dans l'angle du plan de travail : il ne doit jamais recouvrir
// le texte de l'aide, à aucune largeur.
test("10.11 : le bouton du gabarit ne recouvre pas l'aide", async ({
  page,
}) => {
  await creerLivreRaconte(page);
  await bande(page)
    .getByRole("button", { name: "Pages 2 et 3", exact: true })
    .click();
  const bouton = page.getByRole("button", { name: "Changer le gabarit" });
  const aide = page.getByText("Glissez une photo de la réserve");

  for (const largeur of [320, 599, 600, 700, 1100, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    const b = await bouton.boundingBox();
    if (!b) throw new Error(`bouton invisible à ${largeur} px`);
    const t = await boiteDuTexte(aide);
    const chevauche =
      b.x < t.droite &&
      t.gauche < b.x + b.width &&
      b.y < t.bas &&
      t.haut < b.y + b.height;
    expect(chevauche, `chevauchement à ${largeur} px`).toBe(false);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(largeur);
  }
});

// 12.1 : Mes livres offre un deuxième système de navigation, le plan du site.
test("12.1 : Mes livres mène au plan du site", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@bookopia.test`;
  await page.goto("/inscription");
  await page.getByLabel("Votre nom").fill("Créateur de test");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/livres$/);

  await page
    .getByRole("navigation", { name: "Informations sur le site" })
    .getByRole("link", { name: "Plan du site" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Plan du site" }),
  ).toBeFocused();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Mes livres" })
    .click();
  await expect(page).toHaveURL(/\/livres$/);
});

// Le texte seul, sans le padding du paragraphe.
async function boiteDuTexte(element: Locator) {
  return element.evaluate((el) => {
    const plage = document.createRange();
    plage.selectNodeContents(el);
    const r = [...plage.getClientRects()];
    return {
      gauche: Math.min(...r.map((q) => q.left)),
      droite: Math.max(...r.map((q) => q.right)),
      haut: Math.min(...r.map((q) => q.top)),
      bas: Math.max(...r.map((q) => q.bottom)),
    };
  });
}
