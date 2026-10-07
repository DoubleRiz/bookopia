# CLAUDE.md

Instructions pour les agents IA travaillant sur ce dépôt.

## Le projet

Bookopia est une application web de création de **livres photo** avec export **PDF prêt pour l'impression**.

Parti pris produit : **retrancher plutôt qu'ajouter**. Un seul format, des gabarits contraints, pas de canvas libre.

Projet de diplôme CDA : chaque décision technique doit être explicable à un jury, avec son coût assumé.

**Tout est en français** : code, documentation, commentaires, commits, interface. Voir [`docs/conventions.md`](docs/conventions.md).

## Stack

| Composant | Technologie |
|---|---|
| `apps/web` | React · Vite · TypeScript · supabase-js |
| `packages/shared` | Schémas Zod, types générés, rendu PDF (pdf-lib) |
| `supabase/` | Migrations SQL, RLS, fonctions, tests pgTAP, seed |
| Base, authentification, fichiers | Supabase (PostgreSQL, Auth, Storage), en local via la CLI |

Monorepo npm workspaces. Pas de serveur applicatif : le front parle directement à Supabase. La RLS protège chaque table, les règles métier sont des fonctions SQL appelées par `rpc`. Le navigateur prépare les photos et rend le PDF.

Détails et justification de chaque choix : [`docs/architecture.md`](docs/architecture.md).

## Commandes

```bash
npm install                          # racine, tous les workspaces
supabase start                       # base, auth, stockage et Studio en local (Docker)
supabase db reset                    # rejoue les migrations et le seed
supabase test db                     # tests pgTAP (RLS, fonctions)
supabase gen types typescript --local > packages/shared/src/base.ts
npm run dev -w apps/web              # front
npm run lint && npm run typecheck    # avant tout commit
npm test
```

## Règles non négociables

1. **Vocabulaire métier français, littéral**, y compris dans les identifiants de code : `double_page`, `gabarit`, `reserve`, `emplacement`. Jamais « album », « page », « layout », « template ». → [`docs/glossaire.md`](docs/glossaire.md)
2. **Les règles métier vivent dans Supabase** : contraintes, fonctions SQL appelées par `rpc`, triggers pour les automatismes mécaniques, chaque fonction commentée en français. Le navigateur ne fait que ce qu'une base ne sait pas faire : préparer les photos et rendre le PDF.
3. **RLS activée sur toutes les tables**, et les entrées revérifiées dans chaque fonction SQL, même quand le front valide déjà. La clé `service_role` n'est jamais utilisée par l'application.
4. **Rendu PDF avec pdf-lib**, jamais Chromium headless.

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
| `docs/archive/` | Anciennes versions, pour mémoire : ne font pas foi |
