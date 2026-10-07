# Conventions

## Langue

Le projet est **en français** : documentation, commentaires, messages de commit, libellés d'interface, noms de branches.

Les **identifiants suivent le vocabulaire métier français** : `double_page`, `emplacement`, `gabarit`, `reserve`, `modele_livre`. Le métier, les spécifications et la soutenance sont en français : traduire créerait un décalage permanent.

Restent en anglais les termes techniques sans équivalent métier (`id`, `request`, `cache`) et ce qu'un outil impose (hooks React, API de Supabase).

## Nommage

| Élément | Casse | Exemple |
|---|---|---|
| Variables, fonctions TypeScript | camelCase | `calculerDpiEffectif` |
| Types, composants React | PascalCase | `DoublePage`, `EditeurDoublePage` |
| Constantes globales | SCREAMING_SNAKE | `TAILLE_VIGNETTE_PX` |
| Fichiers de composants | PascalCase | `EditeurDoublePage.tsx` |
| Autres fichiers | kebab-case | `calcul-dpi.ts` |
| Tables, colonnes, fonctions SQL | snake_case | `double_page`, `projet_id`, `creer_projet` |
| Migrations | horodatage + snake_case | `20261007120000_creer_tables.sql` |

Les données lues depuis Supabase gardent leurs noms de colonnes : `projet.modifie_le`. Coût assumé : deux casses se côtoient dans le front.

## Structure du dépôt

```
apps/
  web/          React + Vite, préparation des photos, appel du rendu PDF
packages/
  shared/       schémas Zod, types générés, rendu PDF (pdf-lib)
supabase/
  migrations/   tables, contraintes, RLS, fonctions, triggers
  tests/        tests pgTAP (RLS et fonctions)
  seed.sql      catalogue de départ (gabarits, thèmes, modèles)
docs/
```

Monorepo npm workspaces.

## TypeScript

- Mode `strict`, `any` interdit. Préférer `unknown` puis affiner.
- Les schémas Zod sont la source de vérité côté front : les types s'en déduisent avec `z.infer`.
- Les types de la base sont générés par `supabase gen types`, jamais écrits à la main.

## Où vit la logique

| Responsabilité | Lieu |
|---|---|
| Unicité, intégrité, vérifications simples | Contraintes PostgreSQL |
| Autorisation | RLS et droits par colonne |
| Règles qui écrivent plusieurs lignes | Fonctions SQL appelées par `rpc` |
| Automatismes mécaniques (`modifie_le`, ligne `utilisateur`) | Triggers |
| Traitement des photos, rendu PDF | Navigateur |
| Confort d'usage, prévention des erreurs | Front, avec Zod |

La validation du front protège l'utilisateur de ses erreurs, pas le système. **Toute fonction SQL revérifie ses entrées.**

Chaque fonction SQL est commentée en français, ligne à ligne quand la logique n'est pas évidente.

## Tests

- Unitaires (Vitest) sur le moteur de gabarits et le rendu PDF : c'est là que sont les bugs coûteux.
- pgTAP (`supabase test db`) sur les RLS, avec deux utilisateurs, et sur les fonctions SQL. Ils tournent sur la base locale.
- De bout en bout (Playwright) sur les parcours critiques seulement : création de projet, import, composition, export.
- Un test reproduit le bug avant qu'on le corrige.

## Git

- Branches : `feat/nom-court`, `fix/nom-court`, `docs/nom-court`.
- Commits en français, à l'impératif, sans point final : `ajoute le calcul du DPI effectif`.
- Un commit = une intention.
- `npm run lint && npm run typecheck && npm test` passe avant tout commit.

## Commentaires

Un commentaire explique **pourquoi**, jamais **quoi**. Si le « quoi » n'est pas clair, c'est le code qu'il faut renommer.

Les décisions structurantes vivent dans [`architecture.md`](architecture.md), avec leur coût et les alternatives écartées.
