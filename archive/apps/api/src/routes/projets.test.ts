import { rm } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { reponseListeProjetsSchema } from "@bookopia/shared";
import { creerCatalogue, prisma, viderBase } from "../../test/jeu-de-donnees";
import { creerStockageDeTest } from "../../test/stockage-de-test";
import { construireApp } from "../app";
import { NOM_COOKIE_SESSION } from "./authentification";

let app: FastifyInstance;
let racine: string;
let themeId: string;

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
  themeId = (await creerCatalogue()).theme.id;
});

// Passe par l'inscription : la route lit l'identité dans une vraie session, pas dans un paramètre.
async function ouvrirSession(email: string) {
  const reponse = await app.inject({
    method: "POST",
    url: "/auth/inscription",
    payload: {
      email,
      motDePasse: "correct-horse-battery",
      nomAffichage: email,
    },
  });
  const jeton = reponse.cookies.find((c) => c.name === NOM_COOKIE_SESSION);
  if (!jeton)
    throw new Error("l'inscription n'a pas posé de cookie de session");
  return { jeton: jeton.value, utilisateurId: reponse.json().utilisateur.id };
}

function creerProjetEnBase(
  utilisateurId: string,
  titre: string,
  modifieLe: Date,
) {
  return prisma.projet.create({
    data: { utilisateurId, titre, themeId, modifieLe },
  });
}

function listerProjets(jeton: string | undefined) {
  return app.inject({
    method: "GET",
    url: "/projets",
    cookies: jeton ? { [NOM_COOKIE_SESSION]: jeton } : {},
  });
}

describe("GET /projets", () => {
  it("refuse un appel sans session", async () => {
    const reponse = await listerProjets(undefined);

    expect(reponse.statusCode).toBe(401);
    expect(reponse.json().code).toBe("non_authentifie");
  });

  it("renvoie une liste vide pour un Créateur sans livre", async () => {
    const { jeton } = await ouvrirSession("ada@exemple.fr");

    const reponse = await listerProjets(jeton);

    expect(reponse.statusCode).toBe(200);
    expect(reponse.json()).toEqual({ projets: [] });
  });

  it("liste les projets du Créateur, le plus récemment modifié d'abord", async () => {
    const { jeton, utilisateurId } = await ouvrirSession("ada@exemple.fr");
    await creerProjetEnBase(utilisateurId, "Ancien", new Date("2026-01-01"));
    await creerProjetEnBase(utilisateurId, "Récent", new Date("2026-06-01"));

    const reponse = await listerProjets(jeton);

    expect(reponse.statusCode).toBe(200);
    const { projets } = reponseListeProjetsSchema.parse(reponse.json());
    expect(projets.map((p) => p.titre)).toEqual(["Récent", "Ancien"]);
    expect(projets[0]).toMatchObject({
      brouillon: true,
      modifieLe: "2026-06-01T00:00:00.000Z",
    });
  });

  it("ne montre jamais les projets d'un autre Créateur", async () => {
    const ada = await ouvrirSession("ada@exemple.fr");
    const bob = await ouvrirSession("bob@exemple.fr");
    await creerProjetEnBase(ada.utilisateurId, "Islande", new Date());
    await creerProjetEnBase(bob.utilisateurId, "Japon", new Date());

    const reponse = await listerProjets(ada.jeton);

    const { projets } = reponseListeProjetsSchema.parse(reponse.json());
    expect(projets.map((p) => p.titre)).toEqual(["Islande"]);
  });
});
