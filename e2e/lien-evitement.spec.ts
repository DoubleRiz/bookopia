import { expect, test } from "@playwright/test";

// BK-129 (RGAA 12.7) : au clavier, un lien en tout début de page évite de retraverser l'en-tête.
for (const adresse of ["/", "/connexion", "/une-adresse-qui-n-existe-pas"]) {
  test(`${adresse} : le lien d'évitement apparaît au premier Tab et mène au contenu`, async ({
    page,
  }) => {
    await page.goto(adresse);
    const lien = page.getByRole("link", { name: "Aller au contenu" });

    // À la souris, il reste hors de la fenêtre.
    await expect(lien).not.toBeInViewport();

    await page.keyboard.press("Tab");
    await expect(lien).toBeFocused();
    await expect(lien).toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    await expect(lien).not.toBeInViewport();
    // Le lien ne change pas l'adresse : le routeur n'a rien à rejouer.
    expect(new URL(page.url()).hash).toBe("");
  });
}
