import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";

// PNG uni fabriqué à la volée : pas de fichier binaire dans le dépôt, et une couleur par photo
// pour que deux photos n'aient pas la même empreinte.
function png(largeur: number, hauteur: number, [r, v, b]: number[]): Buffer {
  const morceau = (type: string, donnees: Buffer) => {
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
    const controle = Buffer.alloc(4);
    controle.writeUInt32BE(crc32(corps));
    return Buffer.concat([longueur, corps, controle]);
  };
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete.writeUInt8(8, 8); // 8 bits par canal
  entete.writeUInt8(2, 9); // RVB
  const ligne = Buffer.alloc(1 + largeur * 3);
  for (let x = 0; x < largeur; x += 1) {
    ligne.set([r ?? 0, v ?? 0, b ?? 0], 1 + x * 3);
  }
  const pixels = Buffer.concat(Array.from({ length: hauteur }, () => ligne));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau("IHDR", entete),
    morceau("IDAT", deflateSync(pixels)),
    morceau("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(octets: Buffer): number {
  let crc = 0xffffffff;
  for (const octet of octets) {
    crc ^= octet;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

test("le Créateur importe des photos dans la réserve de son livre", async ({
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
  await creation.getByLabel("Titre du livre").fill("Vacances");
  await creation.getByRole("button", { name: "Créer le livre" }).click();

  await expect(page.getByText("Aucune photo pour l'instant")).toBeVisible();
  await page.getByRole("button", { name: "Importer des photos" }).click();
  await expect(page).toHaveURL(/\/livre\/[0-9a-f-]{36}\/import$/);

  const bleu = png(1200, 800, [40, 80, 200]);
  const fenetre = page.getByRole("dialog", { name: "Importer des photos" });
  await fenetre.getByLabel(/Glissez vos photos ici/).setInputFiles([
    { name: "bleu.png", mimeType: "image/png", buffer: bleu },
    { name: "copie-du-bleu.png", mimeType: "image/png", buffer: bleu },
    {
      name: "logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg/>"),
    },
  ]);

  await expect(fenetre.getByText("1 fichier refusé")).toBeVisible();
  await fenetre.getByRole("button", { name: "Importer 2 photos" }).click();

  await expect(fenetre.getByText("1 photo ajoutée à la réserve")).toBeVisible();
  await expect(
    fenetre.getByText("1 photo était déjà dans le livre."),
  ).toBeVisible();

  // Reprise : la même photo, choisie à nouveau, est sautée.
  await fenetre
    .getByRole("button", { name: "Importer d'autres photos" })
    .click();
  await fenetre.getByLabel(/Glissez vos photos ici/).setInputFiles([
    { name: "bleu.png", mimeType: "image/png", buffer: bleu },
    {
      name: "rouge.png",
      mimeType: "image/png",
      buffer: png(1200, 800, [200, 40, 40]),
    },
  ]);
  await fenetre.getByRole("button", { name: "Importer 2 photos" }).click();
  await expect(fenetre.getByText("1 photo ajoutée à la réserve")).toBeVisible();

  await fenetre.getByRole("button", { name: "Voir la réserve" }).click();
  await expect(page.getByText("2 photos")).toBeVisible();
  await expect(page.getByRole("img", { name: "bleu.png" })).toBeVisible();
  await expect(page.getByRole("img", { name: "rouge.png" })).toBeVisible();
});
