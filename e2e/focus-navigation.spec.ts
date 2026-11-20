import { expect, test } from "@playwright/test";

// BK-130 : avec un routeur côté client, le navigateur ne déplace pas le focus. Sans cela,
// un lecteur d'écran n'annonce rien après un changement d'écran.
test("après une navigation, le focus est sur le titre principal du nouvel écran", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByRole("link", { name: "Créer un compte" }).click();

  await expect(page).toHaveURL(/\/inscription$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Créer un compte" }),
  ).toBeFocused();

  await page.getByRole("link", { name: "Se connecter" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Se connecter" }),
  ).toBeFocused();
});

// Le routeur garde la position de défilement : sans retour en haut, une page longue ouverte depuis
// le pied d'une autre s'afficherait vers le bas, son titre focalisé mais hors de la vue.
test("un nouvel écran s'ouvre en haut, son titre visible", async ({ page }) => {
  await page.goto("/");
  const pied = page.getByRole("navigation", { name: "Informations légales" });
  await pied.scrollIntoViewIfNeeded();
  await pied
    .getByRole("link", { name: "Politique de confidentialité" })
    .click();

  const titre = page.getByRole("heading", {
    level: 1,
    name: "Politique de confidentialité",
  });
  await expect(titre).toBeFocused();
  await expect(titre).toBeInViewport();
});

test("le focus ne bouge pas quand seule la recherche de l'adresse change", async ({
  page,
}) => {
  await page.goto("/connexion?retour=%2Flivres");
  await page.getByLabel("Adresse e-mail").focus();

  await page.evaluate(() => {
    window.history.pushState({}, "", "/connexion?retour=%2Flivres&x=1");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.getByLabel("Adresse e-mail")).toBeFocused();
});

// BK-133 : l'éditeur et l'export sont chargés à l'ouverture de leur écran. Le titre n'existe
// qu'une fois le morceau reçu : le focus doit l'attendre, pas tomber sur le corps de la page.
test("le focus arrive sur le titre des écrans chargés à la demande", async ({
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
  await creation.getByLabel("Titre du livre").fill("Bretagne");
  await creation.getByRole("button", { name: "Créer le livre" }).click();

  // Première arrivée sur l'éditeur : son morceau de code vient d'être chargé.
  const titre = page.getByRole("heading", { level: 1, name: "Bretagne" });
  await expect(page).toHaveURL(/\/livre\/[^/]+$/);
  await expect(titre).toBeFocused();

  // Navigation côté client vers l'export, sans passer par la composition du livre.
  await page.evaluate(() => {
    window.history.pushState({}, "", `${window.location.pathname}/export`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/export$/);
  await expect(titre).toBeFocused();
});
