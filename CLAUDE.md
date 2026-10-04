# CLAUDE.md

Instructions pour les agents IA travaillant sur ce dépôt.

## Le projet

Bookopia est une application web de création de **livres photo** avec export **PDF prêt pour l'impression**. Sa valeur propre : une **curation algorithmique** qui suggère des photos à écarter (floues, surexposées, quasi-doublons) — l'utilisateur décide seul.

Parti pris produit : **retrancher plutôt qu'ajouter**. Un seul format, des gabarits contraints, pas de canvas libre.

Projet de diplôme CDA : chaque décision technique doit être explicable à un jury, avec son coût assumé.

**Tout est en français** : code, documentation, commentaires, commits, interface. Voir [`docs/conventions.md`](docs/conventions.md).

## Stack

| Composant | Technologie |
|---|---|
| `apps/web` | React · Vite · TypeScript |
| `apps/api` | Fastify · Prisma · TypeScript |
| `apps/worker` | Node · sharp · pdf-lib |
| `packages/db` | Schéma Prisma, migrations |
| `packages/shared` | Types et schémas Zod partagés |
| Base de données | PostgreSQL en conteneur |
| File d'attente | Table PostgreSQL + `SKIP LOCKED` |
| Fichiers | Disque local, monté en volume |
| Orchestration | Docker Compose |

Monorepo npm workspaces. Le front appelle l'API ; l'API écrit en base et dépose une tâche ; le worker dépile et travaille ; l'avancement remonte en SSE. Le worker ne parle jamais au navigateur.

Détails et justification de chaque choix : [`docs/architecture.md`](docs/architecture.md).

## Commandes

```bash
npm install                          # racine, tous les workspaces
docker compose up                    # base de données + services
npm run dev -w apps/web              # front
npm run dev -w apps/api              # API
npm run dev -w apps/worker           # worker
npm run db:migrate -w packages/db    # migrations
npm run lint && npm run typecheck    # avant tout commit
npm test
```

## Règles non négociables

1. **Vocabulaire métier français, littéral**, y compris dans les identifiants de code : `doublePage`, `gabarit`, `reserve`, `emplacement`. Jamais « album », « page », « layout », « template ». → [`docs/glossaire.md`](docs/glossaire.md)
2. **Aucune dépendance à un service tiers.** L'application tourne à l'identique sur le VPS et en local.
3. **Pas de triggers PostgreSQL.** Contraintes en base, logique procédurale en TypeScript dans l'API.
4. **Validation Zod en entrée d'API**, même quand le front valide déjà.
5. **Rendu PDF avec pdf-lib**, jamais Chromium headless.
6. **Les algorithmes d'analyse d'image sont écrits à la main** (dHash, variance du laplacien, histogramme) : c'est un livrable de soutenance, pas une dépendance.

## Ce qu'un agent ne fait pas

- Ajouter une fonctionnalité non demandée, ou une abstraction pour un besoin hypothétique.
- Introduire une dépendance sans validation explicite.
- Rouvrir une décision tranchée. Si elle semble mauvaise : le dire **une fois**, avec l'argument, puis appliquer.
- Modifier `docs/` ou écrire dans Notion sans demande explicite.

Quand plusieurs options existent : tableau comparatif avec le coût de chacune, puis attendre la décision.

## Documentation

Le dépôt fait foi. Notion héberge les spécifications fonctionnelles (écrans E0 à E10) et le suivi de projet (lots, étapes). En cas de contradiction, **les spécifications fonctionnelles priment sur le modèle de données** pour les écrans et leurs états.

| Fichier | Contenu |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Décisions techniques, coûts, alternatives écartées |
| [`docs/modele-donnees.md`](docs/modele-donnees.md) | Entités, invariants, règle copié/référencé |
| [`docs/glossaire.md`](docs/glossaire.md) | Vocabulaire métier |
| [`docs/conventions.md`](docs/conventions.md) | Nommage, structure, tests, commits |
| [`docs/design-system.md`](docs/design-system.md) | Tokens, composants, états |
