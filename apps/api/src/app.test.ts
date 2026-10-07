import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../test/jeu-de-donnees";
import { construireApp } from "./app";

let app: FastifyInstance;

beforeAll(async () => {
  app = await construireApp(prisma);
});

afterAll(async () => {
  await app.close();
});

describe("santé", () => {
  it("répond ok quand la base répond", async () => {
    const reponse = await app.inject({ method: "GET", url: "/sante" });

    expect(reponse.statusCode).toBe(200);
    expect(reponse.json()).toEqual({ statut: "ok" });
  });
});
