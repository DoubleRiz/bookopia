import { expect, type Page, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { creerLivreImporte, MOT_DE_PASSE } from "./parcours";
import { png } from "./images";

// BK-116 : les états d'erreur dans le navigateur. Le réseau est coupé (setOffline, route.abort)
// ou une requête est refusée (route.fulfill) ; chaque test vérifie le message, puis la reprise.

const REST = "**/rest/v1/**";
const REFUS = {
  status: 400,
  contentType: "application/json",
  body: JSON.stringify({ code: "23514", message: "refusé", details: null }),
};

// Compose le livre et rend le premier cadre de « Pages 2 et 3 », une fois sa photo posée : avant,
// les gestes sont désactivés et la sélection serait perdue au rechargement des doubles pages.
async function ouvrirEditeur(page: Page) {
  await page.getByRole("button", { name: "Composer le livre" }).click();
  const cadre = page
    .getByRole("group", { name: "Pages 2 et 3" })
    .getByRole("button", { name: /^Cadre 1,/ });
  await expect(cadre).toHaveAccessibleName("Cadre 1, photo posée");
  return cadre;
}

test("un écran chargé sans réseau propose de réessayer", async ({ page }) => {
  await creerLivreImporte(page);
  await page.goto("/livres");
  await expect(page.getByText("Carnet de test")).toBeVisible();

  await page.route(REST, (route) => route.abort());
  await page.reload();
  const banniere = page.getByRole("alert");
  // supabase-js réessaie une requête coupée avant de renoncer : la bannière met quelques secondes.
  await expect(banniere).toContainText("Le serveur ne répond pas", {
    timeout: 20_000,
  });

  // Le réseau revient : Réessayer recharge l'écran, sans recharger la page.
  await page.unroute(REST);
  await banniere.getByRole("button", { name: "Réessayer" }).click();
  await expect(page.getByText("Carnet de test")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("l'éditeur hors ligne désactive les gestes, puis les rend au retour du réseau", async ({
  page,
  context,
}) => {
  await creerLivreImporte(page);
  const cadre = await ouvrirEditeur(page);
  await cadre.click();
  await expect(cadre).toHaveAttribute("aria-pressed", "true");
  const vider = page.getByRole("button", { name: "Vider" });
  await expect(vider).toBeEnabled();

  await context.setOffline(true);
  await expect(page.getByRole("alert")).toContainText("Hors-ligne");
  await expect(vider).toBeDisabled();
  await expect(page.getByRole("button", { name: "Recadrer" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Annuler" })).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(vider).toBeEnabled();
});

test("une écriture refusée rétablit le geste, puis se rejoue", async ({
  page,
}) => {
  await creerLivreImporte(page);
  const cadre = await ouvrirEditeur(page);
  const statut = page.getByRole("status");
  await cadre.click();
  await expect(cadre).toHaveAttribute("aria-pressed", "true");

  const refuser = (route: import("@playwright/test").Route) =>
    route.request().method() === "PATCH"
      ? route.fulfill(REFUS)
      : route.continue();
  await page.route("**/rest/v1/emplacement*", refuser);
  await page.getByRole("button", { name: "Vider" }).click();

  await expect(statut).toContainText("Non enregistré");
  await expect(page.getByRole("alert")).toContainText(
    "La modification a été refusée.",
  );
  // Le geste est rétabli : la photo est toujours là.
  await expect(cadre).toHaveAccessibleName("Cadre 1, photo posée");

  // La base accepte de nouveau : Réessayer rejoue le geste.
  await page.unroute("**/rest/v1/emplacement*", refuser);
  await statut.getByRole("button", { name: "Réessayer" }).click();
  await expect(statut).toHaveText("Enregistré");
  await expect(cadre).toHaveAccessibleName("Cadre 1, vide");
  await page.reload();
  await expect(cadre).toHaveAccessibleName("Cadre 1, vide");
});

test("un fichier dont l'envoi échoue figure dans le bilan, les autres passent", async ({
  page,
}) => {
  await creerLivreImporte(page, 1);
  await page.getByRole("button", { name: "Importer des photos" }).click();
  const fenetre = page.getByRole("dialog", { name: "Importer des photos" });
  await fenetre.getByLabel(/Depuis votre appareil/).setInputFiles(
    [
      ["vert", [40, 160, 60]],
      ["rouge", [200, 40, 40]],
    ].map(([nom, couleur]) => ({
      name: `${nom}.png`,
      mimeType: "image/png",
      buffer: png(1200, 800, couleur as number[]),
    })),
  );

  // L'envoi réessaie une fois et les photos partent en parallèle : on refuse toutes les tentatives
  // de dépôt d'un même fichier, le premier vu.
  let refuse: string | null = null;
  await page.route("**/storage/v1/object/photos/**", (route) => {
    const { url, method } = {
      url: route.request().url(),
      method: route.request().method(),
    };
    if (method === "POST" && (refuse ??= url) === url) {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "panne", error: "panne" }),
      });
    }
    return route.continue();
  });
  await fenetre.getByRole("button", { name: "Importer 2 photos" }).click();

  await expect(fenetre.getByText("1 photo ajoutée à la réserve")).toBeVisible();
  await expect(fenetre.getByText("1 photo non importée")).toBeVisible();
  await expect(fenetre.getByText("Envoi impossible")).toBeVisible();
});

test("un export qui échoue le dit et laisse le PDF précédent téléchargeable", async ({
  page,
}) => {
  await creerLivreImporte(page);
  await ouvrirEditeur(page);
  await page.getByRole("link", { name: "Vérifier et exporter" }).click();
  await page.getByRole("button", { name: "Exporter le PDF" }).click();
  const lien = page.getByRole("link", { name: "Télécharger le PDF" });
  await expect(lien).toBeVisible();

  // Le dépôt du nouveau PDF est refusé : l'ancien reste.
  await page.route("**/storage/v1/object/exports/**", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "panne", error: "panne" }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Relancer le rendu" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "L'export a échoué. Réessayez dans un instant.",
  );
  await expect(lien).toBeVisible();
  const reponse = await page.request.get(
    (await lien.getAttribute("href")) ?? "",
  );
  expect(reponse.ok()).toBe(true);
  expect(
    (await PDFDocument.load(await reponse.body())).getPageCount(),
  ).toBeGreaterThan(0);
});

test("une session expirée ramène à la connexion, puis à l'écran demandé", async ({
  page,
}) => {
  const email = await creerLivreImporte(page);
  await ouvrirEditeur(page);
  const adresse = new URL(page.url()).pathname;

  // La session disparaît : le prochain chargement renvoie à la connexion avec l'adresse demandée.
  await page.evaluate(() => {
    for (const cle of Object.keys(localStorage)) {
      if (cle.startsWith("sb-")) localStorage.removeItem(cle);
    }
  });
  await page.reload();
  await expect(page).toHaveURL(/\/connexion\?retour=/);

  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(new RegExp(`${adresse}$`));
  await expect(page.getByRole("group", { name: "Pages 2 et 3" })).toBeVisible();
});

test("une session expirée en pleine édition ramène à la connexion", async ({
  page,
}) => {
  await creerLivreImporte(page);
  const cadre = await ouvrirEditeur(page);
  const adresse = new URL(page.url()).pathname;
  await cadre.click();
  await expect(cadre).toHaveAttribute("aria-pressed", "true");

  await page.route("**/rest/v1/emplacement*", (route) =>
    route.request().method() === "PATCH"
      ? route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ code: "PGRST301", message: "JWT expired" }),
        })
      : route.continue(),
  );
  await page.getByRole("button", { name: "Vider" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/connexion\\?retour=${encodeURIComponent(adresse)}`),
  );
});
