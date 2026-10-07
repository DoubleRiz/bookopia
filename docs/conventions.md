# Conventions

## Langue

Le projet est **en français** : documentation, commentaires, messages de commit, libellés d'interface, noms de branches.

Les **identifiants de code suivent le vocabulaire métier français** : `doublePage`, `emplacement`, `gabarit`, `reserve`, `modeleLivre`. Le métier est français, les spécifications sont françaises, la soutenance sera française — traduire créerait un décalage permanent entre le code et tout le reste.

Restent en anglais les termes techniques universels sans équivalent métier : `id`, `request`, `response`, `cache`, ainsi que ce qu'un outil impose (`createdAt` de Prisma, hooks React).

Coût assumé : les noms sont parfois mixtes (`doublePage.createdAt`), et un relecteur habitué à l'anglais est surpris la première minute.

## Nommage

| Élément | Casse | Exemple |
|---|---|---|
| Variables, fonctions | camelCase | `calculerDpiEffectif` |
| Types, classes, composants React | PascalCase | `DoublePage`, `EditeurDoublePage` |
| Constantes globales | SCREAMING_SNAKE | `TAILLE_VIGNETTE_PX` |
| Fichiers de composants | PascalCase | `EditeurDoublePage.tsx` |
| Autres fichiers | kebab-case | `calcul-dpi.ts` |
| Tables et colonnes | camelCase via Prisma | `doublePage`, `projetId` |
| Routes d'API | kebab-case, pluriel | `/projets/:projetId/doubles-pages` |

## Structure du dépôt

```
apps/
  web/          React + Vite
  api/          Fastify
  worker/       boucle de traitement
packages/
  db/           schema.prisma, migrations, client
  shared/       types, schémas Zod, constantes métier
  stockage/     fichiers sur disque, URL signées (API et worker, jamais le front)
docs/
```

Monorepo npm workspaces. Une dépendance partagée entre deux `apps` passe par un `package` : jamais d'import relatif qui traverse `apps/`.

## TypeScript

- Mode `strict`, `any` interdit. Un `unknown` suivi d'un affinage vaut mieux.
- Les types partagés entre front, API et worker vivent dans `packages/shared`.
- Les schémas Zod sont la source de vérité : les types s'en déduisent avec `z.infer`, pas l'inverse.

## Où vit la logique

| Responsabilité | Lieu |
|---|---|
| Unicité, intégrité référentielle, vérifications simples | Contraintes PostgreSQL |
| Règles métier, orchestration, autorisation | API, en TypeScript |
| Confort d'usage, prévention des erreurs | Front |
| Travail long (analyse d'image, rendu PDF) | Worker |

**Pas de triggers PostgreSQL.** La logique procédurale doit être lisible et testable dans le code.

La validation côté front protège l'utilisateur de ses erreurs ; elle ne protège pas le système. **Toute entrée d'API est revalidée avec Zod**, sans exception.

## Tests

- Unitaires sur le moteur de gabarits et le rendu PDF — c'est là que sont les bugs coûteux.
- Tests d'intégration sur les services et les routes d'API, base de test réelle en conteneur, pas de mock de Prisma. La base `<nom>_test` est dérivée de `DATABASE_URL`, créée et migrée au lancement de `npm test` : les tests ne peuvent pas viser la base de développement par erreur.
- Tests de bout en bout (Playwright) sur les parcours critiques uniquement : création de projet, import, composition, export.
- Un test reproduit le bug avant qu'on le corrige.

## Git

- Branches : `feat/nom-court`, `fix/nom-court`, `docs/nom-court`.
- Commits en français, à l'impératif, sans point final : `ajoute le calcul du DPI effectif`, `corrige la reprise d'import interrompu`.
- Un commit = une intention. Pas de commit fourre-tout.
- `npm run lint && npm run typecheck && npm test` passe avant tout commit.

## Commentaires

Un commentaire explique **pourquoi**, jamais **quoi**. Si le « quoi » n'est pas clair, c'est le code qu'il faut renommer.

Les décisions structurantes ne vivent pas en commentaire mais dans [`architecture.md`](architecture.md), avec leur coût et les alternatives écartées — c'est le matériau de la soutenance.
