# Stockage des fichiers sur disque — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** créer le paquet `@bookopia/stockage` (chemins, signature, stockage disque) et la route `GET /fichiers/*` de l'API qui diffuse un fichier sur présentation d'une URL signée.

**Architecture :** un paquet Node sans dépendance externe, consommé par l'API (le worker plus tard, jamais le front). L'implémentation disque expose l'interface `StockageFichiers` plus une méthode `verifier` propre au disque, utilisée par la route : sur disque, c'est l'API qui sert l'URL signée. La route ne touche pas à la base.

**Tech Stack :** TypeScript strict, `node:fs/promises`, `node:path`, `node:crypto`, Fastify 5, Zod 4, Vitest 5.

**Spec :** [`docs/superpowers/specs/2026-10-06-stockage-fichiers-design.md`](../specs/2026-10-06-stockage-fichiers-design.md)

## Global Constraints

- Tout en français : identifiants, commentaires, messages d'erreur, commits (impératif, sans point final).
- Aucune dépendance externe nouvelle : seulement des modules `node:*` dans `packages/stockage`.
- `packages/stockage` n'est jamais une dépendance de `apps/web`.
- Arborescence : `projets/{projetId}/originaux/{cle}.jpg`, `projets/{projetId}/vignettes/{cle}.webp`, `projets/{projetId}/exports/{cle}.pdf`.
- `projetId` et `cle` sont des UUID ; tout autre identifiant est refusé.
- Signature : HMAC-SHA256 de `chemin + "\n" + expire`, base64url, `expire` en secondes Unix, comparaison `timingSafeEqual`.
- URL produite : `/api/fichiers/{chemin}?expire={expire}&signature={signature}`.
- Secret `SECRET_URL_SIGNEE` d'au moins 32 octets, refusé sinon.
- Codes HTTP de la route : 400 `invalide` (requête mal formée), 403 `interdit` (signature invalide ou expirée), 404 `introuvable` (extension, chemin hors racine, fichier absent), 200 sinon.
- En-têtes 200 : `Content-Type` selon l'extension, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age={secondes restantes}`, `Content-Disposition: attachment` pour les PDF.
- Avant chaque commit : `npm run format`, puis `npm run lint && npm run typecheck && npm test` (le code du plan n'est pas garanti au format Prettier).
- Chaque message de commit se termine par une ligne vide puis `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Traversée encodée dans l'URL** (`/fichiers/..%2F..%2Fsecret.pdf` avec une signature calculée pour ce chemin) : jamais de 200, jamais le contenu d'un fichier hors racine. → test dans la tâche 4.
2. **Paramètres de requête répétés** (`?expire=1&expire=2`) : 400, pas d'exception. → test dans la tâche 4.
3. **Signature vide ou de longueur différente** : refus propre (403 ou `false`), jamais d'exception levée par `timingSafeEqual`. → tests dans les tâches 2 et 4.
4. **Fichier supprimé entre l'émission de l'URL et la lecture** : 404, pas de 500 ni de flux ouvert sur un absent. → test dans la tâche 4.
5. **Expiration à la seconde exacte** (`expire` égal à maintenant) : refusée — une URL n'est valide que strictement avant `expire`. → test dans la tâche 2.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `packages/stockage/package.json` | Déclaration du paquet `@bookopia/stockage` |
| `packages/stockage/tsconfig.json` | TypeScript avec les types Node |
| `packages/stockage/src/chemins.ts` | Construction des chemins relatifs à partir de `(projetId, cle)` |
| `packages/stockage/src/signature.ts` | `signer` / `verifierSignature`, fonctions pures |
| `packages/stockage/src/stockage-disque.ts` | `StockageFichiers`, `StockageDisque`, `creerStockageDisque`, erreurs |
| `packages/stockage/src/index.ts` | Réexports |
| `apps/api/src/fichiers.ts` | Route `GET /fichiers/*` |
| `apps/api/src/app.ts` | `construireApp({ prisma, stockage }, options)`, code `interdit` |
| `apps/api/src/services/erreurs.ts` | Ajout du code `interdit` |
| `apps/api/src/index.ts` | Lecture de `DOSSIER_FICHIERS` et `SECRET_URL_SIGNEE` |
| `apps/api/test/stockage-de-test.ts` | Stockage sur dossier temporaire pour les tests |
| `.env.example`, `docker-compose.yml` | `SECRET_URL_SIGNEE` |
| `docs/architecture.md`, `docs/conventions.md` | Documentation |

---

### Task 1 : paquet `@bookopia/stockage` et chemins

**Files:**
- Create: `packages/stockage/package.json`
- Create: `packages/stockage/tsconfig.json`
- Create: `packages/stockage/src/chemins.ts`
- Create: `packages/stockage/src/index.ts`
- Test: `packages/stockage/src/chemins.test.ts`

**Interfaces:**
- Consumes : rien.
- Produces :
  - `cheminOriginal(projetId: string, cle: string): string`
  - `cheminVignette(projetId: string, cle: string): string`
  - `cheminExport(projetId: string, cle: string): string`

- [ ] **Step 1 : créer le paquet**

`packages/stockage/package.json` :

```json
{
  "name": "@bookopia/stockage",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json"
  }
}
```

`packages/stockage/tsconfig.json` :

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src"]
}
```

`packages/stockage/src/index.ts` :

```ts
// Réservé à l'API et au worker : ce paquet lit et écrit le disque, le front ne doit jamais l'importer.
export * from "./chemins";
```

Run : `npm install` (à la racine, pour lier le nouveau workspace).

- [ ] **Step 2 : écrire le test qui échoue**

`packages/stockage/src/chemins.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { cheminExport, cheminOriginal, cheminVignette } from "./chemins";

const PROJET = "01926b3e-7c1a-7000-8000-000000000001";
const CLE = "01926b3e-7c1a-7000-8000-0000000000aa";

describe("chemins", () => {
  it("range l'original, la vignette et l'export sous le dossier du projet", () => {
    expect(cheminOriginal(PROJET, CLE)).toBe(
      `projets/${PROJET}/originaux/${CLE}.jpg`,
    );
    expect(cheminVignette(PROJET, CLE)).toBe(
      `projets/${PROJET}/vignettes/${CLE}.webp`,
    );
    expect(cheminExport(PROJET, CLE)).toBe(
      `projets/${PROJET}/exports/${CLE}.pdf`,
    );
  });

  it.each([
    ["..", CLE],
    [PROJET, "../../etc/passwd"],
    [PROJET, `${CLE}/x`],
    ["", CLE],
    [PROJET, "pas-un-uuid"],
  ])("refuse un identifiant qui n'est pas un UUID (%s, %s)", (projetId, cle) => {
    expect(() => cheminOriginal(projetId, cle)).toThrow();
    expect(() => cheminVignette(projetId, cle)).toThrow();
    expect(() => cheminExport(projetId, cle)).toThrow();
  });
});
```

- [ ] **Step 3 : vérifier qu'il échoue**

Run : `npx vitest run packages/stockage/src/chemins.test.ts`
Expected : FAIL, module `./chemins` introuvable.

- [ ] **Step 4 : implémenter**

`packages/stockage/src/chemins.ts` :

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// N'accepter que des UUID garantit qu'un chemin construit ne contient ni « .. » ni « / ».
function exigerUuid(valeur: string, nom: string) {
  if (!UUID.test(valeur)) {
    throw new Error(`${nom} n'est pas un UUID : ${valeur}`);
  }
}

function cheminDuProjet(
  projetId: string,
  cle: string,
  dossier: string,
  extension: string,
) {
  exigerUuid(projetId, "projetId");
  exigerUuid(cle, "cle");
  return `projets/${projetId}/${dossier}/${cle}${extension}`;
}

// JPEG : pdf-lib n'intègre que JPEG et PNG, et l'original est ré-encodé de toute façon au redimensionnement.
export function cheminOriginal(projetId: string, cle: string) {
  return cheminDuProjet(projetId, cle, "originaux", ".jpg");
}

// WebP : lue seulement par le navigateur, plus légère qu'un JPEG sur une grille de vignettes.
export function cheminVignette(projetId: string, cle: string) {
  return cheminDuProjet(projetId, cle, "vignettes", ".webp");
}

export function cheminExport(projetId: string, cle: string) {
  return cheminDuProjet(projetId, cle, "exports", ".pdf");
}
```

- [ ] **Step 5 : vérifier que ça passe**

Run : `npx vitest run packages/stockage/src/chemins.test.ts`
Expected : PASS.

- [ ] **Step 6 : commit**

Run : `npm run lint && npm run typecheck && npm test`

```bash
git add packages/stockage package-lock.json
git commit -m "ajoute le paquet de stockage et les conventions de chemins"
```

---

### Task 2 : signature des URL

**Files:**
- Create: `packages/stockage/src/signature.ts`
- Modify: `packages/stockage/src/index.ts`
- Test: `packages/stockage/src/signature.test.ts`

**Interfaces:**
- Consumes : rien.
- Produces :
  - `signer(secret: string, chemin: string, expire: number): string` — base64url
  - `verifierSignature(secret: string, chemin: string, expire: number, signature: string, maintenantSecondes?: number): boolean` — `maintenantSecondes` vaut par défaut `Math.floor(Date.now() / 1000)`

- [ ] **Step 1 : écrire le test qui échoue**

`packages/stockage/src/signature.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { signer, verifierSignature } from "./signature";

const SECRET = "secret-de-test-de-trente-deux-octets-au-moins";
const CHEMIN = "projets/p/originaux/c.jpg";
const MAINTENANT = 1_800_000_000;

describe("signature", () => {
  it("produit une signature base64url stable", () => {
    const signature = signer(SECRET, CHEMIN, MAINTENANT + 60);
    expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(signer(SECRET, CHEMIN, MAINTENANT + 60)).toBe(signature);
  });

  it("accepte une signature valide avant l'expiration", () => {
    const expire = MAINTENANT + 60;
    expect(
      verifierSignature(SECRET, CHEMIN, expire, signer(SECRET, CHEMIN, expire), MAINTENANT),
    ).toBe(true);
  });

  it("refuse une URL expirée, y compris à la seconde exacte", () => {
    const expire = MAINTENANT;
    const signature = signer(SECRET, CHEMIN, expire);
    expect(verifierSignature(SECRET, CHEMIN, expire, signature, MAINTENANT)).toBe(false);
    expect(verifierSignature(SECRET, CHEMIN, expire, signature, MAINTENANT + 1)).toBe(false);
  });

  it("refuse une signature calculée pour un autre chemin, une autre expiration ou un autre secret", () => {
    const expire = MAINTENANT + 60;
    const signature = signer(SECRET, CHEMIN, expire);
    expect(verifierSignature(SECRET, "projets/p/exports/c.pdf", expire, signature, MAINTENANT)).toBe(false);
    expect(verifierSignature(SECRET, CHEMIN, expire + 1, signature, MAINTENANT)).toBe(false);
    expect(verifierSignature(`${SECRET}x`, CHEMIN, expire, signature, MAINTENANT)).toBe(false);
  });

  it("refuse sans lever une signature vide, tronquée ou altérée", () => {
    const expire = MAINTENANT + 60;
    const signature = signer(SECRET, CHEMIN, expire);
    const alteree = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    for (const candidate of ["", signature.slice(1), `${signature}A`, alteree]) {
      expect(verifierSignature(SECRET, CHEMIN, expire, candidate, MAINTENANT)).toBe(false);
    }
  });
});
```

- [ ] **Step 2 : vérifier qu'il échoue**

Run : `npx vitest run packages/stockage/src/signature.test.ts`
Expected : FAIL, module `./signature` introuvable.

- [ ] **Step 3 : implémenter**

`packages/stockage/src/signature.ts` :

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

// Le saut de ligne sépare chemin et expiration : aucun chemin construit n'en contient,
// deux couples différents ne peuvent donc pas produire le même message.
export function signer(secret: string, chemin: string, expire: number) {
  return createHmac("sha256", secret)
    .update(`${chemin}\n${expire}`)
    .digest("base64url");
}

export function verifierSignature(
  secret: string,
  chemin: string,
  expire: number,
  signature: string,
  maintenantSecondes = Math.floor(Date.now() / 1000),
) {
  if (expire <= maintenantSecondes) {
    return false;
  }
  const attendue = Buffer.from(signer(secret, chemin, expire));
  const recue = Buffer.from(signature);
  // timingSafeEqual lève sur des longueurs différentes ; la longueur d'un HMAC n'est pas un secret.
  // La comparaison à temps constant empêche de deviner la signature octet par octet au chronomètre.
  return attendue.length === recue.length && timingSafeEqual(attendue, recue);
}
```

Ajouter à `packages/stockage/src/index.ts` :

```ts
export * from "./signature";
```

- [ ] **Step 4 : vérifier que ça passe**

Run : `npx vitest run packages/stockage/src/signature.test.ts`
Expected : PASS.

- [ ] **Step 5 : commit**

Run : `npm run lint && npm run typecheck && npm test`

```bash
git add packages/stockage/src
git commit -m "ajoute la signature HMAC des URL de fichiers"
```

---

### Task 3 : stockage sur disque

**Files:**
- Create: `packages/stockage/src/stockage-disque.ts`
- Modify: `packages/stockage/src/index.ts`
- Test: `packages/stockage/src/stockage-disque.test.ts`

**Interfaces:**
- Consumes : `signer`, `verifierSignature` (tâche 2).
- Produces :

```ts
interface StockageFichiers {
  ranger(chemin: string, contenu: Buffer): Promise<void>;
  lire(chemin: string): Promise<Buffer>;
  flux(chemin: string): Promise<Readable>;
  supprimer(chemin: string): Promise<void>;
  urlSignee(chemin: string, dureeSecondes: number): Promise<string>;
}
interface StockageDisque extends StockageFichiers {
  verifier(chemin: string, expire: number, signature: string): boolean;
}
function creerStockageDisque(options: { racine: string; secret: string }): StockageDisque;
class FichierIntrouvable extends Error { readonly chemin: string }
class CheminHorsRacine extends Error { readonly chemin: string }
const PREFIXE_URL_FICHIERS = "/api/fichiers";
```

- [ ] **Step 1 : écrire le test qui échoue**

`packages/stockage/src/stockage-disque.test.ts` :

```ts
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
    expect(await readdir(join(racine, "projets/p/originaux"))).toEqual(["c.jpg"]);
    expect((await stockage.lire(CHEMIN)).toString()).toBe("v2");
  });

  it("lève FichierIntrouvable sur un fichier absent", async () => {
    await expect(stockage.lire(CHEMIN)).rejects.toBeInstanceOf(FichierIntrouvable);
  });
});

describe("flux", () => {
  it("restitue le contenu", async () => {
    await stockage.ranger(CHEMIN, Buffer.from("octets"));
    expect(await text(await stockage.flux(CHEMIN))).toBe("octets");
  });

  it("lève FichierIntrouvable avant d'ouvrir un flux sur un absent", async () => {
    await expect(stockage.flux(CHEMIN)).rejects.toBeInstanceOf(FichierIntrouvable);
  });
});

describe("supprimer", () => {
  it("supprime le fichier, et ne lève pas s'il est déjà absent", async () => {
    await stockage.ranger(CHEMIN, Buffer.from("octets"));
    await stockage.supprimer(CHEMIN);
    await expect(stockage.lire(CHEMIN)).rejects.toBeInstanceOf(FichierIntrouvable);
    await expect(stockage.supprimer(CHEMIN)).resolves.toBeUndefined();
  });
});

describe("confinement", () => {
  it.each(["../dehors.jpg", "projets/../../dehors.jpg", "/etc/passwd", "", "."])(
    "refuse le chemin %j pour chaque méthode",
    async (chemin) => {
      await expect(stockage.ranger(chemin, Buffer.from("x"))).rejects.toBeInstanceOf(CheminHorsRacine);
      await expect(stockage.lire(chemin)).rejects.toBeInstanceOf(CheminHorsRacine);
      await expect(stockage.flux(chemin)).rejects.toBeInstanceOf(CheminHorsRacine);
      await expect(stockage.supprimer(chemin)).rejects.toBeInstanceOf(CheminHorsRacine);
      await expect(stockage.urlSignee(chemin, 60)).rejects.toBeInstanceOf(CheminHorsRacine);
    },
  );
});

describe("urlSignee et verifier", () => {
  it("produit une URL que verifier accepte", async () => {
    const url = new URL(await stockage.urlSignee(CHEMIN, 60), "http://hote");
    expect(url.pathname).toBe(`/api/fichiers/${CHEMIN}`);
    const expire = Number(url.searchParams.get("expire"));
    const signature = url.searchParams.get("signature") ?? "";
    expect(expire).toBeGreaterThan(Date.now() / 1000);
    expect(stockage.verifier(CHEMIN, expire, signature)).toBe(true);
    expect(stockage.verifier("projets/p/exports/c.pdf", expire, signature)).toBe(false);
  });

  it("refuse une durée nulle, négative ou non entière", async () => {
    for (const duree of [0, -1, 1.5]) {
      await expect(stockage.urlSignee(CHEMIN, duree)).rejects.toThrow();
    }
  });
});
```

- [ ] **Step 2 : vérifier qu'il échoue**

Run : `npx vitest run packages/stockage/src/stockage-disque.test.ts`
Expected : FAIL, module `./stockage-disque` introuvable.

- [ ] **Step 3 : implémenter**

`packages/stockage/src/stockage-disque.ts` :

```ts
import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { Readable } from "node:stream";
import { signer, verifierSignature } from "./signature";

// Le chemin relatif que le front demande : identique derrière le proxy Vite et derrière Caddy, qui retirent « /api ».
export const PREFIXE_URL_FICHIERS = "/api/fichiers";

const TAILLE_MIN_SECRET_OCTETS = 32;

// L'interface documentée dans architecture.md, plus `flux` : un PDF de plusieurs dizaines de Mo ne se charge pas en mémoire.
export interface StockageFichiers {
  ranger(chemin: string, contenu: Buffer): Promise<void>;
  lire(chemin: string): Promise<Buffer>;
  flux(chemin: string): Promise<Readable>;
  supprimer(chemin: string): Promise<void>;
  urlSignee(chemin: string, dureeSecondes: number): Promise<string>;
}

// Propre au disque : sans fournisseur pour servir l'URL signée, c'est l'API qui la vérifie.
// Avec un stockage objet, cette méthode et la route qui l'appelle disparaîtraient.
export interface StockageDisque extends StockageFichiers {
  verifier(chemin: string, expire: number, signature: string): boolean;
}

export class FichierIntrouvable extends Error {
  constructor(readonly chemin: string) {
    super(`Fichier introuvable : ${chemin}`);
    this.name = "FichierIntrouvable";
  }
}

export class CheminHorsRacine extends Error {
  constructor(readonly chemin: string) {
    super(`Chemin hors de la racine de stockage : ${chemin}`);
    this.name = "CheminHorsRacine";
  }
}

function estAbsent(erreur: unknown) {
  return erreur instanceof Error && "code" in erreur && erreur.code === "ENOENT";
}

export function creerStockageDisque({
  racine,
  secret,
}: {
  racine: string;
  secret: string;
}): StockageDisque {
  if (Buffer.byteLength(secret) < TAILLE_MIN_SECRET_OCTETS) {
    throw new Error(
      `Le secret de signature doit faire au moins ${TAILLE_MIN_SECRET_OCTETS} octets`,
    );
  }
  const racineAbsolue = resolve(racine);

  // Vérifié à chaque appel : la route transmet un chemin venu de l'extérieur.
  function absolu(chemin: string) {
    const resultat = resolve(racineAbsolue, chemin);
    if (!resultat.startsWith(racineAbsolue + sep)) {
      throw new CheminHorsRacine(chemin);
    }
    return resultat;
  }

  return {
    // Écrire à côté puis renommer : un fichier à moitié écrit n'est jamais lisible,
    // et le remplacement d'un export ne laisse aucune fenêtre de lecture corrompue.
    async ranger(chemin, contenu) {
      const cible = absolu(chemin);
      const temporaire = `${cible}.${randomUUID()}.tmp`;
      await mkdir(dirname(cible), { recursive: true });
      try {
        await writeFile(temporaire, contenu);
        await rename(temporaire, cible);
      } catch (erreur) {
        await rm(temporaire, { force: true });
        throw erreur;
      }
    },

    async lire(chemin) {
      const cible = absolu(chemin);
      try {
        return await readFile(cible);
      } catch (erreur) {
        if (estAbsent(erreur)) throw new FichierIntrouvable(chemin);
        throw erreur;
      }
    },

    // Ouvrir avant de renvoyer le flux : l'absence se signale ici, avant que la réponse ne parte.
    async flux(chemin) {
      const cible = absolu(chemin);
      try {
        const fichier = await open(cible);
        return fichier.createReadStream();
      } catch (erreur) {
        if (estAbsent(erreur)) throw new FichierIntrouvable(chemin);
        throw erreur;
      }
    },

    // Idempotent : la purge et le remplacement d'un export n'ont pas à vérifier l'existence.
    async supprimer(chemin) {
      await rm(absolu(chemin), { force: true });
    },

    async urlSignee(chemin, dureeSecondes) {
      absolu(chemin);
      if (!Number.isInteger(dureeSecondes) || dureeSecondes <= 0) {
        throw new Error(`Durée de validité invalide : ${dureeSecondes}`);
      }
      const expire = Math.floor(Date.now() / 1000) + dureeSecondes;
      const signature = signer(secret, chemin, expire);
      return `${PREFIXE_URL_FICHIERS}/${chemin}?expire=${expire}&signature=${signature}`;
    },

    verifier(chemin, expire, signature) {
      return verifierSignature(secret, chemin, expire, signature);
    },
  };
}
```

Ajouter à `packages/stockage/src/index.ts` :

```ts
export * from "./stockage-disque";
```

- [ ] **Step 4 : vérifier que ça passe**

Run : `npx vitest run packages/stockage`
Expected : PASS (les trois fichiers de test).

- [ ] **Step 5 : commit**

Run : `npm run lint && npm run typecheck && npm test`

```bash
git add packages/stockage/src
git commit -m "ajoute le stockage des fichiers sur disque"
```

---

### Task 4 : route de distribution `GET /fichiers/*`

**Files:**
- Create: `apps/api/src/fichiers.ts`
- Create: `apps/api/test/stockage-de-test.ts`
- Modify: `apps/api/package.json` (dépendance `@bookopia/stockage`)
- Modify: `apps/api/src/services/erreurs.ts` (code `interdit`)
- Modify: `apps/api/src/app.ts` (signature de `construireApp`, statut 403, enregistrement de la route)
- Modify: `apps/api/src/index.ts` (variables d'environnement)
- Modify: `apps/api/src/authentification.test.ts:10` (nouvelle signature de `construireApp`)
- Modify: `.env.example`, `docker-compose.yml`
- Test: `apps/api/src/fichiers.test.ts`

**Interfaces:**
- Consumes : `creerStockageDisque`, `StockageDisque`, `FichierIntrouvable`, `CheminHorsRacine`, `signer`, `cheminOriginal`, `cheminVignette`, `cheminExport` (tâches 1 à 3).
- Produces :
  - `construireApp(dependances: { prisma: PrismaClient; stockage: StockageDisque }, options?: FastifyServerOptions)`
  - `routesFichiers(app: FastifyInstance, { stockage }: { stockage: StockageDisque })`
  - code métier `"interdit"` → 403
  - `creerStockageDeTest(): Promise<{ racine: string; stockage: StockageDisque; secret: string }>` (test seulement)

- [ ] **Step 1 : brancher la dépendance et l'outil de test**

Dans `apps/api/package.json`, ajouter à `dependencies` (ordre alphabétique, après `@bookopia/shared`) :

```json
    "@bookopia/stockage": "*",
```

Run : `npm install`

`apps/api/test/stockage-de-test.ts` :

```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creerStockageDisque } from "@bookopia/stockage";

export const SECRET_DE_TEST = "secret-de-test-de-trente-deux-octets-au-moins";

// Un dossier temporaire par appel : les tests n'écrivent jamais dans le volume de développement.
export async function creerStockageDeTest() {
  const racine = await mkdtemp(join(tmpdir(), "bookopia-api-"));
  return {
    racine,
    secret: SECRET_DE_TEST,
    stockage: creerStockageDisque({ racine, secret: SECRET_DE_TEST }),
  };
}
```

- [ ] **Step 2 : écrire le test qui échoue**

`apps/api/src/fichiers.test.ts` :

```ts
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
      /^private, max-age=(\d+)$/.exec(String(reponse.headers["cache-control"]))?.[1],
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

    const autreChemin = await obtenir(url.replace("originaux", "vignettes").replace(".jpg", ".webp"));
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
    const reponse = await obtenir(`/fichiers/${cheminOriginal(PROJET, CLE)}${requete}`);

    expect(reponse.statusCode).toBe(400);
    expect(reponse.json().code).toBe("invalide");
  });
});
```

- [ ] **Step 3 : vérifier qu'il échoue**

Run : `npx vitest run apps/api/src/fichiers.test.ts`
Expected : FAIL — `construireApp` n'accepte pas encore `{ prisma, stockage }` (erreur de type à l'exécution sur `prisma.$queryRaw` absente, ou 404 sur toutes les requêtes).

- [ ] **Step 4 : ajouter le code `interdit`**

`apps/api/src/services/erreurs.ts` :

```ts
// « introuvable » couvre aussi ce qui appartient à un autre utilisateur :
// répondre « interdit » confirmerait que la ressource existe.
// « interdit » est réservé au refus d'une URL signée : il est décidé avant tout accès au fichier,
// et ne révèle donc rien de son existence.
export type CodeErreurMetier =
  "introuvable" | "invalide" | "conflit" | "non_authentifie" | "interdit";
```

(La classe `ErreurMetier` reste inchangée.)

- [ ] **Step 5 : écrire la route**

`apps/api/src/fichiers.ts` :

```ts
import { extname } from "node:path";
import type { Readable } from "node:stream";
import {
  CheminHorsRacine,
  FichierIntrouvable,
  type StockageDisque,
} from "@bookopia/stockage";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ErreurMetier } from "./services/erreurs";

const TYPE_PAR_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

const requeteFichierSchema = z.object({
  expire: z.coerce.number().int().positive(),
  signature: z.string().regex(/^[A-Za-z0-9_-]+$/),
});

// Sur disque, c'est l'API qui sert l'URL signée. Aucune requête en base :
// l'autorisation a été vérifiée à l'émission de l'URL, la signature en est la preuve.
export async function routesFichiers(
  app: FastifyInstance,
  { stockage }: { stockage: StockageDisque },
) {
  app.get("/fichiers/*", async (request, reply) => {
    const chemin = z.object({ "*": z.string() }).parse(request.params)["*"];
    const { expire, signature } = requeteFichierSchema.parse(request.query);

    if (!stockage.verifier(chemin, expire, signature)) {
      throw new ErreurMetier("interdit", "URL de fichier invalide ou expirée");
    }

    const type = TYPE_PAR_EXTENSION[extname(chemin)];
    if (!type) {
      throw new ErreurMetier("introuvable", "Fichier introuvable");
    }

    let flux: Readable;
    try {
      flux = await stockage.flux(chemin);
    } catch (erreur) {
      if (erreur instanceof FichierIntrouvable || erreur instanceof CheminHorsRacine) {
        throw new ErreurMetier("introuvable", "Fichier introuvable");
      }
      throw erreur;
    }

    // Le navigateur garde le fichier tant que l'URL est valide : une grille de vignettes ne se recharge pas à chaque affichage.
    const secondesRestantes = Math.max(0, expire - Math.floor(Date.now() / 1000));
    reply
      .type(type)
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", `private, max-age=${secondesRestantes}`);
    if (type === "application/pdf") {
      reply.header("Content-Disposition", "attachment");
    }
    return reply.send(flux);
  });
}
```

- [ ] **Step 6 : adapter `construireApp`**

Dans `apps/api/src/app.ts` :

Ajouter les imports :

```ts
import type { StockageDisque } from "@bookopia/stockage";
import { routesFichiers } from "./fichiers";
```

Ajouter le statut :

```ts
const STATUT_PAR_CODE: Record<CodeErreurMetier, number> = {
  invalide: 400,
  non_authentifie: 401,
  interdit: 403,
  introuvable: 404,
  conflit: 409,
};
```

Remplacer la signature :

```ts
// Séparé du démarrage : les tests construisent l'application et l'interrogent sans ouvrir de port.
export async function construireApp(
  { prisma, stockage }: { prisma: PrismaClient; stockage: StockageDisque },
  options: FastifyServerOptions = {},
) {
```

Après `await app.register(routesAuthentification, { prisma });`, ajouter :

```ts
  await app.register(routesFichiers, { stockage });
```

- [ ] **Step 7 : adapter le test d'authentification**

Dans `apps/api/src/authentification.test.ts`, ajouter l'import `import { rm } from "node:fs/promises";` et `import { creerStockageDeTest } from "../test/stockage-de-test";`, puis remplacer `beforeAll` / `afterAll` :

```ts
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
```

- [ ] **Step 8 : vérifier que les tests passent**

Run : `npx vitest run apps/api`
Expected : PASS, `fichiers.test.ts` et `authentification.test.ts` compris. Si le test de traversée encodée renvoie 403 plutôt que 404 (Fastify ne décode pas `%2F` dans le joker, la signature ne correspond donc pas), c'est attendu : le test exige seulement « jamais 200 ».

- [ ] **Step 9 : démarrage de l'API, environnement, Compose**

`apps/api/src/index.ts` :

```ts
import { creerClientPrisma } from "@bookopia/db";
import { creerStockageDisque } from "@bookopia/stockage";
import { construireApp } from "./app";

const PORT = Number(process.env.PORT_API ?? 3000);
const URL_BASE = process.env.DATABASE_URL;
const DOSSIER_FICHIERS = process.env.DOSSIER_FICHIERS;
const SECRET_URL_SIGNEE = process.env.SECRET_URL_SIGNEE;

if (!URL_BASE) {
  throw new Error("DATABASE_URL manquante");
}
if (!DOSSIER_FICHIERS) {
  throw new Error("DOSSIER_FICHIERS manquant");
}
// Refuser de démarrer plutôt que de signer avec une valeur vide, que n'importe qui pourrait reproduire.
if (!SECRET_URL_SIGNEE) {
  throw new Error("SECRET_URL_SIGNEE manquant");
}

const prisma = creerClientPrisma(URL_BASE);
const stockage = creerStockageDisque({
  racine: DOSSIER_FICHIERS,
  secret: SECRET_URL_SIGNEE,
});
const app = await construireApp({ prisma, stockage }, { logger: true });

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

await app.listen({ port: PORT, host: "0.0.0.0" });
```

`.env.example`, à la fin, après `DOSSIER_FICHIERS=./donnees/fichiers` :

```
# Signe les URL de fichiers. Au moins 32 octets ; en générer un avec : openssl rand -base64 48
SECRET_URL_SIGNEE=
```

`docker-compose.yml`, dans l'ancre `x-env-app`, après `DOSSIER_FICHIERS: /donnees/fichiers` :

```yaml
  SECRET_URL_SIGNEE: ${SECRET_URL_SIGNEE}
```

Dans le `.env` local (hors dépôt), ajouter une valeur générée par `openssl rand -base64 48`, sinon `npm run dev -w apps/api` refusera de démarrer.

- [ ] **Step 10 : vérification de bout en bout**

Run : `npm run lint && npm run typecheck && npm test`
Expected : tout passe.

Run : `npm run dev -w apps/api`, puis `curl -i http://localhost:3000/fichiers/x?expire=1&signature=abc`
Expected : `403` avec `{"code":"interdit",…}`. Arrêter le serveur.

- [ ] **Step 11 : commit**

```bash
git add apps/api package-lock.json .env.example docker-compose.yml
git commit -m "ajoute la route de distribution des fichiers par URL signée"
```

---

### Task 5 : documentation

**Files:**
- Modify: `docs/architecture.md` (section « Les fichiers »)
- Modify: `docs/conventions.md` (structure du dépôt)

**Interfaces:**
- Consumes : les décisions des tâches 1 à 4.
- Produces : rien pour le code.

- [ ] **Step 1 : réécrire la section « Les fichiers » d'`architecture.md`**

Remplacer le contenu de la section, du titre `## Les fichiers` jusqu'à la ligne `Jeu de test courant à 30 photos, 300 pour la démonstration.` exclue, par :

````markdown
## Les fichiers

Originaux, vignettes et PDF sont écrits sur le disque du serveur, dans le volume Docker `fichiers`, monté dans l'API et le worker. Caddy ne le monte pas : aucun fichier n'est servi directement par le reverse proxy.

### Arborescence

```
projets/
  {projetId}/
    originaux/{cle}.jpg
    vignettes/{cle}.webp
    exports/{cle}.pdf
```

`cleStockage` est un UUID nu, opaque ; le chemin se déduit de `(projetId, cle)` par les fonctions de `@bookopia/stockage`, qui refusent tout identifiant non UUID. L'original et la vignette d'une photo partagent la même clé. Regrouper par projet rend la suppression d'un projet ou d'un compte triviale.

- **Original en JPEG** : pdf-lib n'intègre que JPEG et PNG, et l'original est ré-encodé de toute façon au redimensionnement. Coût : une perte de génération, invisible à qualité 90.
- **Vignette en WebP** : lue seulement par le navigateur, environ 30 % plus légère qu'un JPEG sur une grille de 300. Coût : un second format, produit par `sharp` sans dépendance.

### Accès

L'accès passe par une interface unique, implémentée sur disque aujourd'hui, remplaçable par un stockage objet sans toucher au reste :

```ts
interface StockageFichiers {
  ranger(chemin: string, contenu: Buffer): Promise<void>;
  lire(chemin: string): Promise<Buffer>;
  flux(chemin: string): Promise<Readable>;
  supprimer(chemin: string): Promise<void>;
  urlSignee(chemin: string, dureeSecondes: number): Promise<string>;
}
```

`flux` permet de diffuser un PDF de plusieurs dizaines de Mo sans le charger en mémoire. `ranger` écrit dans un fichier temporaire puis renomme : un fichier à moitié écrit n'est jamais lisible. Tout chemin est vérifié sous la racine.

Le code vit dans `packages/stockage`, et non dans `packages/shared` : il lit le disque, le front ne doit pas pouvoir l'importer.

### Distribution par URL signée

L'API vérifie l'autorisation puis délivre une **URL signée à durée courte** : `/api/fichiers/{chemin}?expire=…&signature=…`, signature HMAC-SHA256 du chemin et de l'expiration avec `SECRET_URL_SIGNEE`.

Sur disque, aucun fournisseur ne sert cette URL : c'est l'API qui la vérifie et diffuse le fichier, par `GET /fichiers/*`, **sans requête en base** — la signature prouve l'autorisation donnée à l'émission. Signature invalide ou expirée : 403 ; fichier absent : 404. Le navigateur garde le fichier en cache jusqu'à l'expiration. Avec un stockage objet, ce rôle passerait au fournisseur et la route disparaîtrait.

| Option | Coût | Décision |
|---|---|---|
| **L'API vérifie la signature et diffuse** | Un secret à gérer ; l'API diffuse des octets | Retenue |
| Caddy diffuse, l'API autorise par `forward_auth` | Volume monté dans Caddy, configuration difficile à tester | Écartée |
| Route protégée par le cookie de session | Abandonne l'URL signée ; une requête en base par vignette | Écartée |

````

(Garder ensuite la ligne `Jeu de test courant à 30 photos, 300 pour la démonstration.` telle quelle.)

- [ ] **Step 2 : ajouter le paquet à la structure dans `conventions.md`**

Dans le bloc de structure du dépôt, remplacer :

```
packages/
  db/           schema.prisma, migrations, client
  shared/       types, schémas Zod, constantes métier
```

par :

```
packages/
  db/           schema.prisma, migrations, client
  shared/       types, schémas Zod, constantes métier
  stockage/     fichiers sur disque, URL signées (API et worker, jamais le front)
```

- [ ] **Step 3 : vérifier et committer**

Run : `npm run lint`
Expected : PASS (Prettier vérifie aussi le Markdown).

```bash
git add docs/architecture.md docs/conventions.md
git commit -m "documente le stockage des fichiers et leur distribution par URL signée"
```
