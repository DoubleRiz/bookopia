# API Fastify : squelette et erreurs normalisées — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objectif :** toute réponse d'erreur de l'API, quelle qu'en soit l'origine, suit un même contrat typé partagé avec le front ; les routes suivent une convention de plugin unique ; le serveur s'arrête proprement sous Docker.

**Architecture :** le contrat `reponseErreurSchema` vit dans `packages/shared`. L'API installe un gestionnaire d'erreurs et de route inconnue (`src/erreurs.ts`) qui traduit chaque origine vers ce contrat. Les routes sont des plugins `FastifyPluginAsync<OptionsRoutes>` dans `src/routes/`, qui reçoivent `prisma` par leurs options. `index.ts` ferme l'application sur `SIGTERM`/`SIGINT`, et la commande Compose fait de `npm` le PID 1 pour que le signal arrive.

**Stack :** Fastify 5, Zod 4 (locale `fr` incluse), Vitest, TypeScript, Docker Compose.

**Spec :** [`docs/superpowers/specs/2026-10-07-api-squelette-design.md`](../specs/2026-10-07-api-squelette-design.md)

## Contraintes globales

- Tout en français : identifiants, commentaires, messages de commit (`<verbe au présent> <objet>`, minuscule, ex. `ajoute …`, `déplace …`).
- Aucune nouvelle dépendance.
- `prisma` arrive par les options des plugins, jamais par une décoration de l'instance.
- Toute entrée d'API passe par `schema.parse(...)` avec un schéma Zod ; une route ne construit jamais elle-même une réponse d'erreur.
- Le message d'une erreur Fastify ou d'une 500 ne sort jamais dans la réponse.
- Tests d'intégration sur la base de test réelle (dérivée de `DATABASE_URL`, préparée par `npm test`), pas de mock de Prisma.
- Avant chaque commit : `npm run lint && npm run typecheck && npm test` passent, depuis la racine.
- Chaque message de commit se termine par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ne pas modifier `docs/` (hors ce plan et la spec).

## Points d'attention en revue

Cas que la spec implique sans les nommer ; chacun a son test dans la tâche 2.

- Corps vide envoyé avec `content-type: application/json` → 400 `invalide`, pas 500.
- Corps JSON valide mais qui n'est pas un objet (`null`) → 400 `invalide`, pas 500.
- Mauvaise méthode sur une route existante (`GET /auth/connexion`) → 404 `introuvable`, au même format qu'une route inconnue.
- Erreur portant un `statusCode` 5xx → 500 `erreur_interne`, sans relayer son statut ni son message.
- Erreur levée dans un `preHandler` (`exigerSession`) → même format qu'une erreur levée dans le handler.

---

### Tâche 1 : routes en plugins sous `src/routes/`

Refactorisation sans changement de comportement : le test de santé est une caractérisation, il passe avant et après.

**Fichiers :**

- Créer : `apps/api/src/routes/options.ts`
- Créer : `apps/api/src/routes/sante.ts`
- Déplacer : `apps/api/src/authentification.ts` → `apps/api/src/routes/authentification.ts`
- Déplacer : `apps/api/src/authentification.test.ts` → `apps/api/src/routes/authentification.test.ts`
- Modifier : `apps/api/src/app.ts`
- Test : `apps/api/src/app.test.ts` (créé)

**Interfaces :**

- Produit : `type OptionsRoutes = { prisma: PrismaClient }` (`src/routes/options.ts`)
- Produit : `routesSante: FastifyPluginAsync<OptionsRoutes>` (`src/routes/sante.ts`)
- Produit : `routesAuthentification: FastifyPluginAsync<OptionsRoutes>`, `creerExigerSession`, `NOM_COOKIE_SESSION` (`src/routes/authentification.ts`)
- Inchangé : `construireApp(prisma: PrismaClient, options?: FastifyServerOptions): Promise<FastifyInstance>` (`src/app.ts`)

- [ ] **Étape 1 : écrire le test de caractérisation de la santé**

Créer `apps/api/src/app.test.ts` :

```ts
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
```

- [ ] **Étape 2 : vérifier qu'il passe avant la refactorisation**

Lancer depuis la racine : `npx vitest run apps/api/src/app.test.ts`
Attendu : PASS (1 test). Prérequis : le conteneur `db` tourne (`docker compose up -d db`).

- [ ] **Étape 3 : créer `src/routes/options.ts`**

```ts
import type { PrismaClient } from "@bookopia/db";

// Convention des plugins de routes :
// - un fichier par ressource, qui exporte `routesX: FastifyPluginAsync<OptionsRoutes>` ;
// - enregistré dans app.ts par `app.register(routesX, { prisma })` ;
// - toute entrée (body, params, query) passe par `schema.parse(...)` avec un schéma de @bookopia/shared ;
// - une route ne construit jamais de réponse d'erreur : elle lève ErreurMetier ou laisse remonter.
// prisma arrive par les options plutôt que par une décoration de l'instance : décoré, il serait
// accessible à toute route, alors que l'architecture réserve cet accès au dépôt.
export type OptionsRoutes = { prisma: PrismaClient };
```

- [ ] **Étape 4 : créer `src/routes/sante.ts`** (contenu repris de `app.ts`)

```ts
import type { FastifyPluginAsync } from "fastify";
import type { OptionsRoutes } from "./options";

// La santé inclut la base : une API qui répond sans pouvoir lire ses données n'est pas en état de servir.
export const routesSante: FastifyPluginAsync<OptionsRoutes> = async (
  app,
  { prisma },
) => {
  app.get("/sante", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { statut: "ok" };
    } catch (erreur) {
      app.log.error(erreur);
      return reply.code(503).send({ statut: "base_injoignable" });
    }
  });
};
```

- [ ] **Étape 5 : déplacer l'authentification et son test**

```bash
git mv apps/api/src/authentification.ts apps/api/src/routes/authentification.ts
git mv apps/api/src/authentification.test.ts apps/api/src/routes/authentification.test.ts
```

- [ ] **Étape 6 : adapter `src/routes/authentification.ts`**

Remplacer le bloc d'imports du haut par :

```ts
import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from "fastify";
import type { PrismaClient } from "@bookopia/db";
import { connexionSchema, inscriptionSchema } from "@bookopia/shared";
import { ErreurMetier } from "../services/erreurs";
import {
  connecter,
  deconnecter,
  inscrire,
  type SessionOuverte,
  utilisateurDeSession,
} from "../services/sessions";
import type { OptionsRoutes } from "./options";
```

Remplacer la signature :

```ts
export async function routesAuthentification(
  app: FastifyInstance,
  { prisma }: { prisma: PrismaClient },
) {
```

par :

```ts
export const routesAuthentification: FastifyPluginAsync<OptionsRoutes> = async (
  app,
  { prisma },
) => {
```

et l'accolade fermante de cette fonction (dernière ligne du fichier) `}` par `};`. Le corps ne change pas. `PrismaClient` reste importé : `creerExigerSession` l'utilise.

- [ ] **Étape 7 : adapter les imports de `src/routes/authentification.test.ts`**

```ts
import { prisma, viderBase } from "../../test/jeu-de-donnees";
import { construireApp } from "../app";
import { NOM_COOKIE_SESSION } from "./authentification";
```

(remplacent respectivement `"../test/jeu-de-donnees"`, `"./app"`, `"./authentification"` ; le reste du fichier ne change pas.)

- [ ] **Étape 8 : brancher les plugins dans `src/app.ts`**

Dans les imports, remplacer `import { routesAuthentification } from "./authentification";` par :

```ts
import { routesAuthentification } from "./routes/authentification";
import { routesSante } from "./routes/sante";
```

Supprimer le bloc `app.get("/sante", …)` et son commentaire, et remplacer `await app.register(routesAuthentification, { prisma });` par :

```ts
  await app.register(routesSante, { prisma });
  await app.register(routesAuthentification, { prisma });
```

Le gestionnaire d'erreurs reste dans `app.ts` pour cette tâche.

- [ ] **Étape 9 : vérifier**

Lancer depuis la racine : `npm run lint && npm run typecheck && npm test`
Attendu : tout passe, dont `app.test.ts` (1 test) et `routes/authentification.test.ts` (inchangé en nombre de tests). Si Prettier se plaint du formatage, lancer `npm run format` puis relancer.

- [ ] **Étape 10 : commit**

```bash
git add apps/api/src
git commit -m "range les routes de l'API en plugins sous src/routes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tâche 2 : contrat d'erreur partagé et gestionnaire unique

**Fichiers :**

- Créer : `packages/shared/src/erreurs.ts`
- Modifier : `packages/shared/src/index.ts`
- Modifier : `apps/api/src/services/erreurs.ts`
- Créer : `apps/api/src/erreurs.ts`
- Modifier : `apps/api/src/app.ts`
- Test : `apps/api/src/app.test.ts` (remplacé en entier)

**Interfaces :**

- Consomme : `OptionsRoutes`, `routesSante`, `routesAuthentification` (tâche 1)
- Produit : `codeErreurSchema`, `reponseErreurSchema`, `type CodeErreur`, `type ReponseErreur` (exportés par `@bookopia/shared`)
- Produit : `installerGestionErreurs(app: FastifyInstance): void` (`apps/api/src/erreurs.ts`)
- Modifié : `type CodeErreurMetier = Extract<CodeErreur, "introuvable" | "invalide" | "conflit" | "non_authentifie">`

- [ ] **Étape 1 : écrire le contrat dans `packages/shared/src/erreurs.ts`**

```ts
import { z } from "zod";

// Corps de toute réponse d'erreur de l'API, quelle qu'en soit l'origine.
// message : présent pour une erreur métier ; champs : présent pour une erreur de validation.
export const codeErreurSchema = z.enum([
  "invalide",
  "non_authentifie",
  "introuvable",
  "conflit",
  "trop_volumineux",
  "erreur_interne",
]);

export const reponseErreurSchema = z.object({
  code: codeErreurSchema,
  message: z.string().optional(),
  champs: z.record(z.string(), z.array(z.string())).optional(),
});

export type CodeErreur = z.infer<typeof codeErreurSchema>;
export type ReponseErreur = z.infer<typeof reponseErreurSchema>;
```

Ajouter à `packages/shared/src/index.ts`, après `export * from "./entrees";` :

```ts
export * from "./erreurs";
```

- [ ] **Étape 2 : écrire les tests d'erreurs**

Remplacer tout `apps/api/src/app.test.ts` par :

```ts
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
      payload: { email: "pas-un-email", motDePasse: "court", nomAffichage: "Ada" },
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
```

- [ ] **Étape 3 : vérifier que les nouveaux tests échouent**

Lancer depuis la racine : `npx vitest run apps/api/src/app.test.ts`
Attendu : FAIL sur « JSON mal formé » (500 reçu), « corps vide » (500), « 1 Mio » (500), « 415 » (500), « messages en français » (message anglais), et les deux « 404 » (le corps Fastify n'a pas de `code`, `reponseErreurSchema.parse` lève). Les autres passent déjà.

- [ ] **Étape 4 : dériver `CodeErreurMetier` du contrat**

Remplacer dans `apps/api/src/services/erreurs.ts` la définition du type (le commentaire au-dessus reste) :

```ts
import type { CodeErreur } from "@bookopia/shared";

// « introuvable » couvre aussi ce qui appartient à un autre utilisateur :
// répondre « interdit » confirmerait que la ressource existe.
export type CodeErreurMetier = Extract<
  CodeErreur,
  "introuvable" | "invalide" | "conflit" | "non_authentifie"
>;
```

La classe `ErreurMetier` ne change pas.

- [ ] **Étape 5 : écrire `apps/api/src/erreurs.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { ZodError, z } from "zod";
import type { ReponseErreur } from "@bookopia/shared";
import { type CodeErreurMetier, ErreurMetier } from "./services/erreurs";

const STATUT_PAR_CODE: Record<CodeErreurMetier, number> = {
  invalide: 400,
  non_authentifie: 401,
  introuvable: 404,
  conflit: 409,
};

// Fastify et ses plugins (JSON mal formé, corps trop gros, fichier trop lourd…) portent le statut HTTP sur l'erreur.
function statutHttp(erreur: unknown): number | undefined {
  if (
    typeof erreur === "object" &&
    erreur !== null &&
    "statusCode" in erreur &&
    typeof erreur.statusCode === "number"
  ) {
    return erreur.statusCode;
  }
  return undefined;
}

// Toute réponse d'erreur passe par ici : le front n'a qu'un format à connaître, reponseErreurSchema.
export function installerGestionErreurs(app: FastifyInstance): void {
  app.setErrorHandler((erreur, request, reply) => {
    if (erreur instanceof ErreurMetier) {
      return reply
        .code(STATUT_PAR_CODE[erreur.code])
        .send({ code: erreur.code, message: erreur.message } satisfies ReponseErreur);
    }
    if (erreur instanceof ZodError) {
      return reply.code(400).send({
        code: "invalide",
        champs: z.flattenError(erreur).fieldErrors,
      } satisfies ReponseErreur);
    }
    // Le message d'une erreur Fastify est en anglais et décrit le fonctionnement interne : seul le statut sort.
    const statut = statutHttp(erreur);
    if (statut !== undefined && statut >= 400 && statut < 500) {
      return reply
        .code(statut)
        .send({ code: statut === 413 ? "trop_volumineux" : "invalide" } satisfies ReponseErreur);
    }
    request.log.error(erreur);
    return reply.code(500).send({ code: "erreur_interne" } satisfies ReponseErreur);
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ code: "introuvable" } satisfies ReponseErreur),
  );
}
```

- [ ] **Étape 6 : brancher le gestionnaire et la locale dans `src/app.ts`**

Remplacer tout `apps/api/src/app.ts` par :

```ts
import cookie from "@fastify/cookie";
import Fastify, { type FastifyServerOptions } from "fastify";
import { z } from "zod";
import type { PrismaClient } from "@bookopia/db";
import { installerGestionErreurs } from "./erreurs";
import { routesAuthentification } from "./routes/authentification";
import { routesSante } from "./routes/sante";

// Messages de validation en français : le front valide déjà avec les mêmes schémas,
// ceux de l'API ne s'affichent qu'en dernier recours.
z.config(z.locales.fr());

// Séparé du démarrage : les tests construisent l'application et l'interrogent sans ouvrir de port.
export async function construireApp(
  prisma: PrismaClient,
  options: FastifyServerOptions = {},
) {
  const app = Fastify(options);

  app.decorateRequest("utilisateur", null);
  installerGestionErreurs(app);
  await app.register(cookie);

  await app.register(routesSante, { prisma });
  await app.register(routesAuthentification, { prisma });

  return app;
}
```

- [ ] **Étape 7 : vérifier que les tests passent**

Lancer depuis la racine : `npx vitest run apps/api/src/app.test.ts`
Attendu : PASS (12 tests).

Si « messages en français » échoue uniquement sur le libellé exact de l'email, c'est que la locale de Zod a changé de formulation : relever le message reçu et ajuster l'attendu, pas le code.

- [ ] **Étape 8 : vérification complète**

Lancer depuis la racine : `npm run lint && npm run typecheck && npm test`
Attendu : tout passe. Les tests d'authentification qui vérifient des erreurs (`invalide`, `conflit`, `non_authentifie`) passent sans modification : le format de ces réponses n'a pas changé.

- [ ] **Étape 9 : commit**

```bash
git add packages/shared/src apps/api/src
git commit -m "normalise toutes les réponses d'erreur de l'API sur un contrat partagé

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Tâche 3 : arrêt propre, y compris sous Docker

Pas de test automatisé : un signal envoyé au processus de test arrêterait Vitest. La vérification est manuelle et ses résultats sont rapportés tels quels.

**Fichiers :**

- Modifier : `apps/api/src/index.ts`
- Modifier : `docker-compose.yml:32`

**Interfaces :**

- Consomme : `construireApp` (inchangé)

- [ ] **Étape 1 : gérer les signaux dans `src/index.ts`**

Remplacer tout `apps/api/src/index.ts` par :

```ts
import { creerClientPrisma } from "@bookopia/db";
import { construireApp } from "./app";

const PORT = Number(process.env.PORT_API ?? 3000);
const URL_BASE = process.env.DATABASE_URL;

if (!URL_BASE) {
  throw new Error("DATABASE_URL manquante");
}

const prisma = creerClientPrisma(URL_BASE);
const app = await construireApp(prisma, { logger: true });

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

// Docker envoie SIGTERM à chaque arrêt du conteneur : on termine les requêtes en cours
// au lieu d'être tué dix secondes plus tard. Un second signal ne relance pas la fermeture.
let arretEnCours = false;

async function arreter(signal: NodeJS.Signals) {
  if (arretEnCours) {
    return;
  }
  arretEnCours = true;
  app.log.info({ signal }, "arrêt demandé");
  try {
    await app.close();
  } catch (erreur) {
    app.log.error(erreur, "échec de l'arrêt");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void arreter("SIGTERM"));
process.on("SIGINT", () => void arreter("SIGINT"));

await app.listen({ port: PORT, host: "0.0.0.0" });
```

Pas de `process.exit(0)` après une fermeture réussie : Node sort de lui-même quand plus rien ne tourne. S'il ne sort pas, une ressource reste ouverte ; la chercher plutôt que forcer la sortie.

- [ ] **Étape 2 : faire de `npm` le PID 1 du conteneur `api`**

Dans `docker-compose.yml`, service `api`, remplacer :

```yaml
    command: sh -c "npm run db:deploy -w packages/db && npm start -w apps/api"
```

par :

```yaml
    # exec : npm remplace sh comme PID 1 et relaie SIGTERM jusqu'à Node ; sh ne le relaierait pas.
    command: sh -c "npm run db:deploy -w packages/db && exec npm start -w apps/api"
```

Ne pas toucher au service `worker` (hors périmètre, traité avec l'étape du worker).

- [ ] **Étape 3 : vérifier l'arrêt hors Docker**

Depuis `apps/api`, sur un port libre pour ne pas gêner le conteneur `api` :

```bash
PORT_API=3100 npx tsx --env-file-if-exists=../../.env src/index.ts > /tmp/api-arret.log 2>&1 &
PID=$!
sleep 3
curl -s localhost:3100/sante
kill -TERM $PID
wait $PID; echo "code de sortie : $?"
grep -c "arrêt demandé" /tmp/api-arret.log
```

Attendu : `{"statut":"ok"}`, puis `code de sortie : 0` en moins d'une seconde, puis `1`. Si le processus ne sort pas dans les 5 secondes, arrêter, ne pas commiter, et rapporter.

- [ ] **Étape 4 : vérifier l'arrêt sous Docker**

Reconstruit et redémarre le conteneur `api` local de l'utilisateur.

```bash
docker compose --profile app up -d --build api
sleep 5
time docker compose stop api
docker compose logs api | grep "arrêt demandé"
docker compose --profile app up -d api
```

Attendu : `docker compose stop api` rend la main en nettement moins de 10 s (avant correction : environ 10 s, Docker tuant le conteneur), et la ligne `arrêt demandé` apparaît dans les logs. Le dernier `up -d` remet le conteneur en route.

- [ ] **Étape 5 : vérification complète et commit**

Lancer depuis la racine : `npm run lint && npm run typecheck && npm test` — attendu : tout passe.

```bash
git add apps/api/src/index.ts docker-compose.yml
git commit -m "arrête l'API proprement sur SIGTERM, y compris sous Docker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
