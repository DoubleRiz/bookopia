import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CheminHorsRacine,
  creerStockageDisque,
  FichierIntrouvable,
  type StockageDisque,
} from "./stockage-disque";

const SECRET = "secret-de-test-de-trente-deux-octets-au-moins";
const CHEMIN = "projets/p/originaux/c.jpg";

let racine: string;
let stockage: StockageDisque;

beforeEach(async () => {
  racine = await mkdtemp(join(tmpdir(), "bookopia-stockage-"));
  stockage = creerStockageDisque({ racine, secret: SECRET });
});

afterEach(async () => {
  await rm(racine, { recursive: true, force: true });
});

describe("creerStockageDisque", () => {
  it("refuse un secret de moins de 32 octets", () => {
    expect(() => creerStockageDisque({ racine, secret: "court" })).toThrow();
  });
});

describe("ranger et lire", () => {
  it("crée les dossiers manquants et relit le contenu", async () => {
    await stockage.ranger(CHEMIN, Buffer.from("octets"));
    expect((await stockage.lire(CHEMIN)).toString()).toBe("octets");
  });

  it("ne laisse aucun fichier temporaire et remplace un fichier existant", async () => {
    await stockage.ranger(CHEMIN, Buffer.from("v1"));
    await stockage.ranger(CHEMIN, Buffer.from("v2"));
    expect(await readdir(join(racine, "projets/p/originaux"))).toEqual([
      "c.jpg",
    ]);
    expect((await stockage.lire(CHEMIN)).toString()).toBe("v2");
  });

  it("lève FichierIntrouvable sur un fichier absent", async () => {
    await expect(stockage.lire(CHEMIN)).rejects.toBeInstanceOf(
      FichierIntrouvable,
    );
  });
});

describe("flux", () => {
  it("restitue le contenu", async () => {
    await stockage.ranger(CHEMIN, Buffer.from("octets"));
    expect(await text(await stockage.flux(CHEMIN))).toBe("octets");
  });

  it("lève FichierIntrouvable avant d'ouvrir un flux sur un absent", async () => {
    await expect(stockage.flux(CHEMIN)).rejects.toBeInstanceOf(
      FichierIntrouvable,
    );
  });
});

describe("supprimer", () => {
  it("supprime le fichier, et ne lève pas s'il est déjà absent", async () => {
    await stockage.ranger(CHEMIN, Buffer.from("octets"));
    await stockage.supprimer(CHEMIN);
    await expect(stockage.lire(CHEMIN)).rejects.toBeInstanceOf(
      FichierIntrouvable,
    );
    await expect(stockage.supprimer(CHEMIN)).resolves.toBeUndefined();
  });
});

describe("confinement", () => {
  it.each([
    "../dehors.jpg",
    "projets/../../dehors.jpg",
    "/etc/passwd",
    "",
    ".",
  ])("refuse le chemin %j pour chaque méthode", async (chemin) => {
    await expect(
      stockage.ranger(chemin, Buffer.from("x")),
    ).rejects.toBeInstanceOf(CheminHorsRacine);
    await expect(stockage.lire(chemin)).rejects.toBeInstanceOf(
      CheminHorsRacine,
    );
    await expect(stockage.flux(chemin)).rejects.toBeInstanceOf(
      CheminHorsRacine,
    );
    await expect(stockage.supprimer(chemin)).rejects.toBeInstanceOf(
      CheminHorsRacine,
    );
    await expect(stockage.urlSignee(chemin, 60)).rejects.toBeInstanceOf(
      CheminHorsRacine,
    );
  });
});

describe("urlSignee et verifier", () => {
  it("produit une URL que verifier accepte", async () => {
    const url = new URL(await stockage.urlSignee(CHEMIN, 60), "http://hote");
    expect(url.pathname).toBe(`/api/fichiers/${CHEMIN}`);
    const expire = Number(url.searchParams.get("expire"));
    const signature = url.searchParams.get("signature") ?? "";
    expect(expire).toBeGreaterThan(Date.now() / 1000);
    expect(stockage.verifier(CHEMIN, expire, signature)).toBe(true);
    expect(
      stockage.verifier("projets/p/exports/c.pdf", expire, signature),
    ).toBe(false);
  });

  it("refuse une durée nulle, négative ou non entière", async () => {
    for (const duree of [0, -1, 1.5]) {
      await expect(stockage.urlSignee(CHEMIN, duree)).rejects.toThrow();
    }
  });
});
