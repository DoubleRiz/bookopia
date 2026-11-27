import { expect, test } from "@playwright/test";

// BK-125 : obligation légale (LCEN). La page est publique, et le pied de l'accueil y mène.
test("le Visiteur lit les mentions légales depuis le pied de l'accueil", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Informations sur le site" })
    .getByRole("link", { name: "Mentions légales" })
    .click();

  await expect(page).toHaveURL(/\/mentions-legales$/);
  await expect(page).toHaveTitle(/Mentions légales/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Mentions légales" }),
  ).toBeFocused();
  await expect(page.getByText("Gautier Baleda").first()).toBeVisible();
  await expect(page.getByText("Vercel Inc.")).toBeVisible();
  await expect(page.getByText("Supabase Pte. Ltd.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "gautier.baleda@gmail.com" }),
  ).toBeVisible();
});

test("la page s'ouvre directement, sans compte", async ({ page }) => {
  await page.goto("/mentions-legales");
  await expect(page).toHaveURL(/\/mentions-legales$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Mentions légales" }),
  ).toBeVisible();
});
