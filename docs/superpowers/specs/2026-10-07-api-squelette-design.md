# API Fastify : squelette, plugins, validation des entrées, gestion d'erreurs — conception

Étape Notion : *API Fastify : squelette, plugins, validation des entrées, gestion d'erreurs* — lot L1 · Socle technique.

**Livrable** : serveur qui démarre, route de santé, erreurs normalisées. C'est par cette couche que passent toutes les écritures.

## Point de départ

Sur `main`, l'API démarre déjà, `construireApp` est séparé du démarrage, `/sante` vérifie la base, et un gestionnaire d'erreurs traduit `ErreurMetier` et `ZodError`. Une sonde par `inject` a montré les trous suivants :

| Cas | Réponse actuelle |
|---|---|
| JSON mal formé | 500 `erreur_interne` |
| Corps de plus de 1 Mio | 500 `erreur_interne` |
| Route inconnue | 404 au format Fastify `{ statusCode, error, message }` |
| Erreur de validation Zod | 400, messages en anglais |

S'y ajoutent : aucun format d'erreur partagé avec le front, aucun arrêt propre sur `SIGTERM` (envoyé par Docker à chaque redémarrage), aucune convention écrite pour les plugins de routes.

## Périmètre

Dans le périmètre :

- le contrat d'erreur dans `packages/shared` ;
- un gestionnaire d'erreurs et de route inconnue qui couvre toutes les origines ;
- les messages de validation Zod en français ;
- la structure `src/routes/` et le modèle de plugin de routes ;
- l'arrêt propre du serveur, y compris le relais du signal dans la commande Compose du service `api` ;
- les tests d'intégration correspondants.

Hors périmètre :

- la limitation des tentatives de connexion (reste à faire de l'authentification) ;
- le dépôt construit à partir de l'utilisateur authentifié et sa règle ESLint (étape d'autorisation) ;
- le flux SSE (étape export) ;
- la validation des paramètres de route : aucune route actuelle n'en a ; la convention est posée, le premier schéma arrive avec le CRUD projet ;
- le masquage de l'en-tête `cookie` dans les journaux : le sérialiseur de requête par défaut de Fastify ne journalise pas les en-têtes, il n'y a rien à masquer ;
- la mise à jour de `docs/` hors de cette spec.

## Décisions

### Validation : `schema.parse` explicite, sans type provider

| Option | Coût | Décision |
|---|---|---|
| **A. `schema.parse(request.body)` dans chaque route** | Une ligne par entrée ; typage manuel du résultat (déduit par Zod) | Retenue |
| B. `fastify-type-provider-zod`, schémas déclarés sur la route | Nouvelle dépendance à valider ; couplage aux versions Fastify et Zod | Écartée |

Le modèle actuel fonctionne et se lit sans connaître de bibliothèque ; l'erreur Zod remonte au gestionnaire commun.

### Messages de validation en français

| Option | Exemple pour `champs.email` | Décision |
|---|---|---|
| **A. Locale française de Zod** (`z.config(z.locales.fr())`, inclus dans Zod 4) | `["Adresse e-mail invalide"]` | Retenue |
| B. Codes d'anomalie Zod sans message | `["invalid_format"]` | Écartée : table de traduction côté front |
| C. Messages anglais | `["Invalid email address"]` | Écartée : contraire à la convention « tout en français » |

Le front valide déjà avec les mêmes schémas `shared` : ces messages servent en dernier recours. Coût : la formulation dépend de Zod. L'appel est fait au chargement de l'API ; le front décidera pour lui-même.

### Câblage de `prisma` : injection par les options du plugin

| Option | Coût | Décision |
|---|---|---|
| A. `app.prisma` décoré via `fastify-plugin` | Dépendance à déclarer ; `prisma` accessible à toute route, contraire à la règle du dépôt d'`architecture.md` | Écartée |
| **B. `{ prisma }` passé dans les options de chaque plugin de routes** | Une ligne par `register` | Retenue |
| C. `app.decorate("prisma", …)` sur l'instance racine | Même accès que A | Écartée |

`architecture.md` prévoit qu'aucun service n'appelle `prisma` directement et qu'une règle ESLint en interdit l'import hors du dépôt. Une décoration rendrait `request.server.prisma` accessible partout et contournerait cette règle. Avec B, le jour où le dépôt arrive, seule sa fabrique reçoit `prisma`.

## Le contrat d'erreur

Dans `packages/shared/src/erreurs.ts`, exporté par `index.ts` :

```ts
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

Le schéma est la source de vérité, conformément aux conventions. `CodeErreurMetier` (dans `apps/api/src/services/erreurs.ts`) devient un sous-ensemble de `CodeErreur` : `Extract<CodeErreur, "invalide" | "non_authentifie" | "introuvable" | "conflit">`. `ErreurMetier` ne change pas.

## Le gestionnaire d'erreurs

`apps/api/src/erreurs.ts` exporte une fonction qui installe `setErrorHandler` et `setNotFoundHandler` sur l'instance. Elle remplace le gestionnaire actuellement écrit dans `app.ts`.

| Origine | Statut | Corps |
|---|---|---|
| `ErreurMetier` | 400 / 401 / 404 / 409 selon le code, comme aujourd'hui | `{ code, message }` |
| `ZodError` | 400 | `{ code: "invalide", champs }` |
| Erreur portant un `statusCode` 4xx (JSON mal formé, type de contenu non supporté, corps trop gros, plus tard les limites de `@fastify/multipart`) | son `statusCode` | 413 → `{ code: "trop_volumineux" }` ; tout autre 4xx → `{ code: "invalide" }` |
| Route inconnue | 404 | `{ code: "introuvable" }` |
| Tout le reste | 500 | `{ code: "erreur_interne" }`, l'erreur journalisée côté serveur seulement |

Le message d'une erreur Fastify n'est pas renvoyé : il est en anglais et décrit le fonctionnement interne. Le message d'une 500 ne l'est jamais.

## Structure de `apps/api/src`

```
app.ts                  construit l'application : locale Zod, gestionnaire d'erreurs, plugins de routes
index.ts                démarrage et arrêt propre
erreurs.ts              gestionnaire d'erreurs et de route inconnue
routes/
  options.ts            type OptionsRoutes = { prisma: PrismaClient } et convention des plugins de routes
  sante.ts              GET /sante, sorti de app.ts
  authentification.ts   déplacé depuis src/ avec git mv, typé FastifyPluginAsync<OptionsRoutes>
services/               inchangé
```

**Convention des plugins de routes**, écrite en commentaire dans `routes/options.ts` :

- un fichier par ressource, qui exporte `routesX: FastifyPluginAsync<OptionsRoutes>` ;
- enregistré dans `app.ts` par `app.register(routesX, { prisma })` ;
- toute entrée (`body`, `params`, `query`) passe par `schema.parse(...)` avec un schéma de `@bookopia/shared` ;
- une route ne construit jamais une réponse d'erreur elle-même : elle lève `ErreurMetier` ou laisse remonter.

`creerExigerSession` et `NOM_COOKIE_SESSION` restent exportés par `routes/authentification.ts` ; leurs importeurs (tests) suivent le déplacement.

## Arrêt propre

Dans `index.ts`, sur `SIGTERM` et `SIGINT` : `app.close()`. Fastify cesse d'accepter des connexions, termine celles en cours, puis le hook `onClose` existant déconnecte Prisma. Un échec de fermeture est journalisé et le processus sort avec le code 1. Un second signal pendant la fermeture n'en relance pas une autre.

Le signal doit encore atteindre Node. Dans `docker-compose.yml`, le service `api` est lancé par `sh -c "… && npm start -w apps/api"` : `sh` est le PID 1 et ne relaie pas `SIGTERM` à ses enfants, Docker attend dix secondes puis tue le conteneur. La commande devient `sh -c "… && exec npm start -w apps/api"` : `npm` remplace `sh` comme PID 1 et relaie le signal à `tsx`, qui le relaie à Node. Le service `worker` a le même défaut ; il sera corrigé avec l'étape du worker.

## Tests

Nouveau fichier `apps/api/src/app.test.ts`, en intégration sur la base de test réelle :

- `GET /sante` → 200 `{ statut: "ok" }` ;
- JSON mal formé → 400 `invalide` ;
- corps JSON de plus de 1 Mio → 413 `trop_volumineux` ;
- type de contenu non supporté (`application/xml` ; `text/plain` est accepté par Fastify) → 415 `invalide` ;
- route inconnue → 404 `introuvable` ;
- exception quelconque, sur une route de test ajoutée avant le premier `inject` → 500 `erreur_interne`, sans le message de l'exception ;
- erreur de validation → messages en français ;
- chaque corps d'erreur ci-dessus est accepté par `reponseErreurSchema`.

Les tests d'authentification existants passent sans autre changement que leurs chemins d'import.

L'arrêt propre se vérifie à la main : serveur lancé, `kill -TERM`, sortie avec le code 0 et Prisma déconnecté ; puis `docker compose stop api` rend la main en bien moins de dix secondes.
