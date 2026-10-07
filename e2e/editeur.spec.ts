import { expect, type Page, test } from "@playwright/test";
import { png } from "./images";

async function creerLivreAvecPhotos(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@bookopia.test`;
  await page.goto("/inscription");
  await page.getByLabel("Votre nom").fill("Créateur de test");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("parcours-e2e-local");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await page.getByRole("button", { name: "Créer mon premier livre" }).click();
  const creation = page.getByRole("dialog", { name: "Nouveau livre" });
  await creation.getByLabel("Titre du livre").fill("Éditeur");
  await creation.getByRole("button", { name: "Créer le livre" }).click();

  await page.getByRole("button", { name: "Importer des photos" }).click();
  const fenetre = page.getByRole("dialog", { name: "Importer des photos" });
  await fenetre.getByLabel(/Glissez vos photos ici/).setInputFiles(
    (
      [
        ["rouge", [200, 40, 40]],
        ["vert", [40, 160, 60]],
        ["bleu", [40, 80, 200]],
      ] as const
    ).map(([nom, couleur]) => ({
      name: `${nom}.png`,
      mimeType: "image/png",
      buffer: png(1200, 800, [...couleur]),
    })),
  );
  await fenetre.getByRole("button", { name: "Importer 3 photos" }).click();
  await expect(
    fenetre.getByText("3 photos ajoutées à la réserve"),
  ).toBeVisible();
  await fenetre.getByRole("button", { name: "Voir la réserve" }).click();
  await page.getByRole("button", { name: "Composer le livre" }).click();
}

test("le Créateur pose, recadre et vide des photos, et organise ses doubles pages", async ({
  page,
}) => {
  await creerLivreAvecPhotos(page);

  const statut = page.getByRole("status");
  const courante = page.getByRole("group", { name: "Pages 2 et 3" });
  const cadre = courante.getByRole("button", { name: /^Cadre 1,/ });
  await expect(cadre).toHaveAccessibleName("Cadre 1, photo posée");

  // Clavier : sélectionner le cadre, le vider.
  await cadre.focus();
  await page.keyboard.press("Enter");
  await expect(cadre).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Delete");
  await expect(cadre).toHaveAccessibleName("Cadre 1, vide");
  await expect(statut).toHaveText("Enregistré");

  // Souris : glisser une photo de la réserve sur le cadre (encore sélectionné, d'où son nom).
  await page
    .getByRole("button", { name: /^Poser « rouge\.png »/ })
    .dragTo(cadre);
  await expect(cadre).toHaveAccessibleName("Cadre 1, photo posée");
  await expect(statut).toHaveText("Enregistré");

  // Clavier : cadre sélectionné, puis la photo choisie dans la réserve.
  await page.getByRole("button", { name: "Vider" }).click();
  await expect(cadre).toHaveAccessibleName("Cadre 1, vide");
  await cadre.click();
  await page
    .getByRole("button", {
      name: "Poser « vert.png » dans le cadre sélectionné",
    })
    .press("Enter");
  await expect(cadre).toHaveAccessibleName("Cadre 1, photo posée");

  // Recadrer : zoom 2, enregistré.
  await page.getByRole("button", { name: "Recadrer" }).click();
  const recadrage = page.getByRole("dialog", { name: "Recadrer la photo" });
  await recadrage.getByLabel("Zoom").fill("2");
  await recadrage.getByRole("button", { name: "Valider" }).click();
  await expect(recadrage).toBeHidden();
  await expect(statut).toHaveText("Enregistré");

  // Structure : ajouter, dupliquer, déplacer, supprimer.
  const bande = page.getByRole("navigation", {
    name: "Doubles pages intérieures",
  });
  const miniatures = bande.getByRole("button", { name: /^Pages / });
  const depart = await miniatures.count();

  await bande
    .getByRole("button", {
      name: "Ajouter une double page après la page courante",
    })
    .click();
  await expect(miniatures).toHaveCount(depart + 1);
  // La nouvelle double page devient la page courante, au rang 2.
  await expect(
    bande.getByRole("button", { name: "Pages 4 et 5" }),
  ).toHaveAttribute("aria-current", "page");

  await bande.getByRole("button", { name: "Dupliquer" }).click();
  await expect(miniatures).toHaveCount(depart + 2);
  await expect(
    bande.getByRole("button", { name: "Pages 6 et 7" }),
  ).toHaveAttribute("aria-current", "page");

  await bande.getByRole("button", { name: "← Déplacer à gauche" }).click();
  await expect(
    bande.getByRole("button", { name: "Pages 4 et 5" }),
  ).toHaveAttribute("aria-current", "page");

  await bande.getByRole("button", { name: "Supprimer" }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Supprimer cette double page ?",
  });
  await expect(
    confirmation.getByRole("button", { name: "Annuler" }),
  ).toBeFocused();
  await confirmation.getByRole("button", { name: "Supprimer" }).click();
  await expect(miniatures).toHaveCount(depart + 1);

  // Après rechargement, tout est conservé.
  const premiere = bande.getByRole("button", { name: "Pages 2 et 3" });
  await premiere.click();
  await expect(premiere).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(miniatures).toHaveCount(depart + 1);
  await expect(cadre).toHaveAccessibleName("Cadre 1, photo posée");
  await cadre.click();
  await page.getByRole("button", { name: "Recadrer" }).click();
  await expect(recadrage.getByLabel("Zoom")).toHaveValue("2");
});

test("le Créateur change le gabarit d'une double page, après avertissement", async ({
  page,
}) => {
  await creerLivreAvecPhotos(page);

  const courante = page.getByRole("group", { name: "Pages 2 et 3" });
  const cadresRemplis = courante.getByRole("button", {
    name: /^Cadre \d+, photo posée/,
  });
  await expect(cadresRemplis.first()).toBeVisible();
  const bande = page.getByRole("navigation", {
    name: "Doubles pages intérieures",
  });
  const choix = page.getByRole("dialog", { name: "Changer le gabarit" });
  const autreGabarit = choix.locator("button:not([disabled])").first();

  // La page porte une photo : on prévient, « Garder l'actuel » ne retire rien.
  await bande.getByRole("button", { name: "Changer le gabarit" }).click();
  await expect(choix.getByText("Actuel")).toBeVisible();
  const nom = await autreGabarit.getAttribute("aria-label");
  await autreGabarit.click();
  const avertissement = page.getByRole("dialog", {
    name: "Remplacer le gabarit ?",
  });
  await expect(
    avertissement.getByRole("button", { name: "Garder l'actuel" }),
  ).toBeFocused();
  await avertissement.getByRole("button", { name: "Garder l'actuel" }).click();
  await expect(autreGabarit).toBeVisible();

  await autreGabarit.click();
  await avertissement.getByRole("button", { name: "Remplacer" }).click();
  await expect(choix).toBeHidden();
  await expect(cadresRemplis).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Enregistré");

  // Après rechargement : le nouveau gabarit est l'actuel, ses cadres vides,
  // et les photos sont toujours dans la réserve.
  await page.reload();
  await expect(courante).toBeVisible();
  await expect(cadresRemplis).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Supprimer « rouge.png »" }),
  ).toBeVisible();
  await bande.getByRole("button", { name: "Changer le gabarit" }).click();
  await expect(
    choix.getByRole("button", { name: `${nom}, gabarit actuel` }),
  ).toBeDisabled();

  // Page vide : le changement s'applique sans avertissement.
  await autreGabarit.click();
  await expect(choix).toBeHidden();
  await expect(avertissement).toBeHidden();
});
