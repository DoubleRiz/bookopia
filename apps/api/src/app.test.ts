import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ReponseErreur, reponseErreurSchema } from "@bookopia/shared";
import { prisma } from "../test/jeu-de-donnees";
import { construireApp } from "./app";

let app: FastifyInstance;

beforeAll(async () => {
  app = await construireApp(prisma);
  // Routes de test, ajoutées avant le premier inject : après, l'instance est figée.
  app.get("/test/panne", async () => {
    throw new Error("détail interne à ne pas divulguer");
  });
  app.get("/test/panne-5xx", async () => {
    throw Object.assign(new Error("passerelle en panne"), { statusCode: 502 });
  });
});

afterAll(async () => {
  await app.close();
});

// Chaque corps d'erreur doit respecter le contrat partagé avec le front.
function corpsErreur(reponse: LightMyRequestResponse): ReponseErreur {
  return reponseErreurSchema.parse(reponse.json());
}

function envoyer(contentType: string, payload: string) {
  return app.inject({
    method: "POST",
    url: "/auth/connexion",
    headers: { "content-type": contentType },
    payload,
  });
}

describe("santé", () => {
  it("répond ok quand la base répond", async () => {
    const reponse = await app.inject({ method: "GET", url: "/sante" });

    expect(reponse.statusCode).toBe(200);
    expect(reponse.json()).toEqual({ statut: "ok" });
  });
});

describe("erreurs du corps de requête", () => {
  it("refuse un JSON mal formé en 400", async () => {
    const reponse = await envoyer("application/json", "{pas du json");

    expect(reponse.statusCode).toBe(400);
    expect(corpsErreur(reponse)).toEqual({ code: "invalide" });
  });

  it("refuse un corps vide annoncé comme JSON en 400", async () => {
    const reponse = await envoyer("application/json", "");

    expect(reponse.statusCode).toBe(400);
    expect(corpsErreur(reponse)).toEqual({ code: "invalide" });
  });

  it("refuse un corps de plus de 1 Mio en 413", async () => {
    const reponse = await envoyer(
      "application/json",
      JSON.stringify({ email: "x".repeat(1_100_000) }),
    );

    expect(reponse.statusCode).toBe(413);
    expect(corpsErreur(reponse)).toEqual({ code: "trop_volumineux" });
  });

  it("refuse un type de contenu non supporté en 415", async () => {
    const reponse = await envoyer("application/xml", "<connexion/>");

    expect(reponse.statusCode).toBe(415);
    expect(corpsErreur(reponse)).toEqual({ code: "invalide" });
  });

  it("refuse un JSON qui n'est pas un objet en 400", async () => {
    const reponse = await envoyer("application/json", "null");

    expect(reponse.statusCode).toBe(400);
    expect(corpsErreur(reponse).code).toBe("invalide");
  });
});

describe("erreurs de validation", () => {
  it("renvoie les champs fautifs avec des messages en français", async () => {
    const reponse = await app.inject({
      method: "POST",
      url: "/auth/inscription",
      payload: {
        email: "pas-un-email",
        motDePasse: "court",
        nomAffichage: "Ada",
      },
    });

    expect(reponse.statusCode).toBe(400);
    const corps = corpsErreur(reponse);
    expect(corps.code).toBe("invalide");
    expect(corps.champs?.email).toEqual(["adresse e-mail invalide"]);
    expect(corps.champs?.motDePasse).toHaveLength(1);
  });
});

describe("routes inconnues", () => {
  it("répond 404 introuvable pour un chemin inconnu", async () => {
    const reponse = await app.inject({ method: "GET", url: "/inexistante" });

    expect(reponse.statusCode).toBe(404);
    expect(corpsErreur(reponse)).toEqual({ code: "introuvable" });
  });

  it("répond 404 introuvable pour une méthode non prévue sur un chemin connu", async () => {
    const reponse = await app.inject({ method: "GET", url: "/auth/connexion" });

    expect(reponse.statusCode).toBe(404);
    expect(corpsErreur(reponse)).toEqual({ code: "introuvable" });
  });
});

describe("erreurs métier", () => {
  it("garde le statut et le message d'une erreur levée avant le handler", async () => {
    const reponse = await app.inject({ method: "GET", url: "/auth/moi" });

    expect(reponse.statusCode).toBe(401);
    expect(corpsErreur(reponse)).toEqual({
      code: "non_authentifie",
      message: "Session absente ou expirée",
    });
  });
});

describe("erreurs internes", () => {
  it("répond 500 sans divulguer le message de l'exception", async () => {
    const reponse = await app.inject({ method: "GET", url: "/test/panne" });

    expect(reponse.statusCode).toBe(500);
    expect(corpsErreur(reponse)).toEqual({ code: "erreur_interne" });
    expect(reponse.body).not.toContain("détail interne");
  });

  it("ramène à 500 une erreur qui porte un statut 5xx", async () => {
    const reponse = await app.inject({ method: "GET", url: "/test/panne-5xx" });

    expect(reponse.statusCode).toBe(500);
    expect(corpsErreur(reponse)).toEqual({ code: "erreur_interne" });
  });
});
