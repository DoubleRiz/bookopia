import { rm } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma, viderBase } from "../test/jeu-de-donnees";
import { creerStockageDeTest } from "../test/stockage-de-test";
import { construireApp } from "./app";
import { NOM_COOKIE_SESSION } from "./authentification";

let app: FastifyInstance;
let racine: string;

beforeAll(async () => {
  const { stockage, racine: racineDeTest } = await creerStockageDeTest();
  racine = racineDeTest;
  app = await construireApp({ prisma, stockage });
});

afterAll(async () => {
  await app.close();
  await rm(racine, { recursive: true, force: true });
});

beforeEach(async () => {
  await viderBase();
});

const INSCRIPTION = {
  email: "Ada@Exemple.fr",
  motDePasse: "correct-horse-battery",
  nomAffichage: "Ada",
};

function jetonDe(reponse: Awaited<ReturnType<FastifyInstance["inject"]>>) {
  return reponse.cookies.find((c) => c.name === NOM_COOKIE_SESSION)?.value;
}

async function inscrire() {
  return app.inject({
    method: "POST",
    url: "/auth/inscription",
    payload: INSCRIPTION,
  });
}

async function moi(jeton: string | undefined) {
  return app.inject({
    method: "GET",
    url: "/auth/moi",
    cookies: jeton ? { [NOM_COOKIE_SESSION]: jeton } : {},
  });
}

describe("inscription", () => {
  it("crée le compte, hache le mot de passe et ouvre une session", async () => {
    const reponse = await inscrire();

    expect(reponse.statusCode).toBe(201);
    expect(reponse.json().utilisateur).toMatchObject({
      email: "ada@exemple.fr",
      nomAffichage: "Ada",
    });
    const cookie = reponse.cookies.find((c) => c.name === NOM_COOKIE_SESSION);
    expect(cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });

    const enBase = await prisma.utilisateur.findUniqueOrThrow({
      where: { email: "ada@exemple.fr" },
    });
    expect(enBase.motDePasseHache).toMatch(/^\$argon2id\$/);
    expect(enBase.motDePasseHache).not.toContain(INSCRIPTION.motDePasse);
  });

  it("ne stocke que l'empreinte du jeton", async () => {
    const jeton = jetonDe(await inscrire());
    const sessions = await prisma.session.findMany();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.jetonHache).not.toBe(jeton);
  });

  it("refuse un email déjà pris, quelle que soit la casse", async () => {
    await inscrire();
    const reponse = await app.inject({
      method: "POST",
      url: "/auth/inscription",
      payload: { ...INSCRIPTION, email: "ADA@exemple.fr" },
    });

    expect(reponse.statusCode).toBe(409);
  });

  it("refuse un mot de passe trop court", async () => {
    const reponse = await app.inject({
      method: "POST",
      url: "/auth/inscription",
      payload: { ...INSCRIPTION, motDePasse: "court" },
    });

    expect(reponse.statusCode).toBe(400);
    expect(reponse.json().champs).toHaveProperty("motDePasse");
  });
});

describe("connexion", () => {
  beforeEach(async () => {
    await inscrire();
  });

  it("ouvre une nouvelle session avec les bons identifiants", async () => {
    const reponse = await app.inject({
      method: "POST",
      url: "/auth/connexion",
      payload: { email: "ada@exemple.fr", motDePasse: INSCRIPTION.motDePasse },
    });

    expect(reponse.statusCode).toBe(200);
    expect((await moi(jetonDe(reponse))).statusCode).toBe(200);
    expect(await prisma.session.count()).toBe(2);
  });

  it("répond pareil pour un email inconnu et un mot de passe faux", async () => {
    const motDePasseFaux = await app.inject({
      method: "POST",
      url: "/auth/connexion",
      payload: { email: "ada@exemple.fr", motDePasse: "pas-le-bon-mot" },
    });
    const emailInconnu = await app.inject({
      method: "POST",
      url: "/auth/connexion",
      payload: { email: "inconnu@exemple.fr", motDePasse: "pas-le-bon-mot" },
    });

    expect(motDePasseFaux.statusCode).toBe(401);
    expect(emailInconnu.statusCode).toBe(401);
    expect(emailInconnu.json()).toEqual(motDePasseFaux.json());
    expect(jetonDe(motDePasseFaux)).toBeUndefined();
  });
});

describe("session", () => {
  it("identifie l'utilisateur à partir du cookie", async () => {
    const jeton = jetonDe(await inscrire());
    const reponse = await moi(jeton);

    expect(reponse.statusCode).toBe(200);
    expect(reponse.json().utilisateur.email).toBe("ada@exemple.fr");
  });

  it("refuse une requête sans cookie ou avec un jeton inventé", async () => {
    await inscrire();

    expect((await moi(undefined)).statusCode).toBe(401);
    expect((await moi("jeton-invente")).statusCode).toBe(401);
  });

  it("refuse une session expirée", async () => {
    const jeton = jetonDe(await inscrire());
    await prisma.session.updateMany({ data: { expireLe: new Date(0) } });

    expect((await moi(jeton)).statusCode).toBe(401);
  });

  it("la déconnexion révoque le jeton côté serveur", async () => {
    const jeton = jetonDe(await inscrire());
    const reponse = await app.inject({
      method: "POST",
      url: "/auth/deconnexion",
      cookies: { [NOM_COOKIE_SESSION]: jeton ?? "" },
    });

    expect(reponse.statusCode).toBe(204);
    // Le jeton copié avant la déconnexion ne sert plus à rien.
    expect((await moi(jeton)).statusCode).toBe(401);
    expect(await prisma.session.count()).toBe(0);
  });
});
