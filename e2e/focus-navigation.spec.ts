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
