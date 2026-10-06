import { rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  cheminExport,
  cheminOriginal,
  cheminVignette,
  signer,
  type StockageDisque,
} from "@bookopia/stockage";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../test/jeu-de-donnees";
import { creerStockageDeTest } from "../test/stockage-de-test";
import { construireApp } from "./app";

const PROJET = "01926b3e-7c1a-7000-8000-000000000001";
const CLE = "01926b3e-7c1a-7000-8000-0000000000aa";

let app: FastifyInstance;
let stockage: StockageDisque;
let racine: string;
let secret: string;

beforeAll(async () => {
  ({ stockage, racine, secret } = await creerStockageDeTest());
  app = await construireApp({ prisma, stockage });
});

afterAll(async () => {
  await app.close();
  await rm(racine, { recursive: true, force: true });
});

// L'API est derrière un proxy qui retire « /api » : on interroge la route sans ce préfixe.
async function obtenir(url: string) {
  return app.inject({ method: "GET", url: url.replace(/^\/api/, "") });
}

function maintenant() {
  return Math.floor(Date.now() / 1000);
}

describe("GET /fichiers/*", () => {
  it.each([
    [cheminOriginal(PROJET, CLE), "image/jpeg", undefined],
    [cheminVignette(PROJET, CLE), "image/webp", undefined],
    [cheminExport(PROJET, CLE), "application/pdf", "attachment"],
  ])("sert %s avec ses en-têtes", async (chemin, type, disposition) => {
    await stockage.ranger(chemin, Buffer.from("contenu"));

    const reponse = await obtenir(await stockage.urlSignee(chemin, 600));

    expect(reponse.statusCode).toBe(200);
    expect(reponse.body).toBe("contenu");
    expect(reponse.headers["content-type"]).toBe(type);
    expect(reponse.headers["x-content-type-options"]).toBe("nosniff");
    expect(reponse.headers["content-disposition"]).toBe(disposition);
    const maxAge = Number(
      /^private, max-age=(\d+)$/.exec(
        String(reponse.headers["cache-control"]),
      )?.[1],
    );
    expect(maxAge).toBeGreaterThan(590);
    expect(maxAge).toBeLessThanOrEqual(600);
  });

  it("répond 403 à une URL expirée", async () => {
    const chemin = cheminOriginal(PROJET, CLE);
    await stockage.ranger(chemin, Buffer.from("contenu"));
    const expire = maintenant() - 1;

    const reponse = await obtenir(
      `/fichiers/${chemin}?expire=${expire}&signature=${signer(secret, chemin, expire)}`,
    );

    expect(reponse.statusCode).toBe(403);
    expect(reponse.json().code).toBe("interdit");
  });

  it("répond 403 à une signature altérée ou portée sur un autre chemin", async () => {
    const chemin = cheminOriginal(PROJET, CLE);
    await stockage.ranger(chemin, Buffer.from("contenu"));
    const url = await stockage.urlSignee(chemin, 600);

    const autreChemin = await obtenir(
      url.replace("originaux", "vignettes").replace(".jpg", ".webp"),
    );
    const vide = await obtenir(url.replace(/signature=[^&]+/, "signature=A"));

    expect(autreChemin.statusCode).toBe(403);
    expect(vide.statusCode).toBe(403);
  });

  it("répond 404 à un fichier supprimé après l'émission de l'URL", async () => {
    const chemin = cheminOriginal(PROJET, CLE);
    await stockage.ranger(chemin, Buffer.from("contenu"));
    const url = await stockage.urlSignee(chemin, 600);
    await stockage.supprimer(chemin);

    const reponse = await obtenir(url);

    expect(reponse.statusCode).toBe(404);
    expect(reponse.json().code).toBe("introuvable");
  });

  it("répond 404 à une extension non reconnue, même correctement signée", async () => {
    const chemin = `projets/${PROJET}/originaux/${CLE}.png`;
    await stockage.ranger(chemin, Buffer.from("contenu"));

    const reponse = await obtenir(await stockage.urlSignee(chemin, 600));

    expect(reponse.statusCode).toBe(404);
  });

  it("ne sert jamais un fichier hors de la racine, même avec une traversée encodée et signée", async () => {
    const dehors = join(dirname(racine), "secret-hors-racine.pdf");
    await writeFile(dehors, "confidentiel");
    const chemin = "../secret-hors-racine.pdf";
    const expire = maintenant() + 600;

    try {
      const reponse = await obtenir(
        `/fichiers/..%2Fsecret-hors-racine.pdf?expire=${expire}&signature=${signer(secret, chemin, expire)}`,
      );

      expect(reponse.statusCode).not.toBe(200);
      expect(reponse.body).not.toContain("confidentiel");
    } finally {
      await rm(dehors, { force: true });
    }
  });

  it.each([
    "",
    "?expire=1",
    "?signature=abc",
    "?expire=demain&signature=abc",
    "?expire=1&expire=2&signature=abc",
    "?expire=1&signature=pas+base64url!",
  ])("répond 400 à une requête mal formée (%j)", async (requete) => {
    const reponse = await obtenir(
      `/fichiers/${cheminOriginal(PROJET, CLE)}${requete}`,
    );

    expect(reponse.statusCode).toBe(400);
    expect(reponse.json().code).toBe("invalide");
  });
});
