---
name: traiter-etape
description: À utiliser quand Gautier demande de traiter, réaliser, démarrer ou reprendre une étape (ou un lot) du « 🗺️ Suivi du projet » dans Notion, ou toute tâche de Bookopia qui doit finir en pull request. Couvre tout ce qui précède `/preparer-pr` : branche, conception, implémentation, vérifications.
argument-hint: "[liens ou titres des étapes Notion]"
---

# Traiter une étape jusqu'à la PR

Une étape Notion devient une branche, puis une PR. Ce skill couvre le chemin jusqu'à une branche prête. La revue, la PR et la fusion restent dans `/preparer-pr` et `/fusionner-pr` : ne pas les refaire ici.

Étapes indiquées : $ARGUMENTS

**Règle de périmètre : une étape (ou un groupe d'étapes indissociables) = une branche = une PR.** Ce qui sort du périmètre est noté, pas fait.

**L'urgence réduit le périmètre, jamais les vérifications.** « Vite », « ce soir » : proposer de couper l'étape ou de reporter un critère dans « Non traité ». Aucun point d'arrêt ne saute, aucun test ne saute, et l'agent ne valide jamais une spec à la place de Gautier.

Invoquer ce skill sur une étape vaut demande explicite, au sens de `CLAUDE.md`, pour deux choses seulement : lire Notion, et écrire la spec et le plan dans `docs/superpowers/`. Toute écriture dans Notion et tout autre fichier de `docs/` restent soumis à l'accord de Gautier.

## 1. Lire l'étape

- Les étapes vivent dans la base « 🗺️ Suivi du projet » (`collection://7731b961-f581-836e-82b9-873f77b7750f`). Si aucune n'est indiquée, proposer celles « À faire » du lot en cours et faire choisir.
- Lire chaque étape : critères d'acceptation, livrable, notes, écran visé (spécifications E0 à E10) et règles RG citées. Les spécifications fonctionnelles priment sur le modèle de données.
- Si Notion ne répond pas (connecteur absent ou non authentifié), le dire et demander le lien ou le texte de l'étape. Ne pas deviner les critères.
- Restituer en quelques lignes : ce qui sera livré, les critères, ce qui reste flou. Poser les questions sur le flou maintenant, pas pendant l'implémentation.
- Avec l'accord de Gautier, passer le Statut à « En cours ».

## 2. Partir d'une base propre

```bash
git status --short
git branch --show-current
git fetch origin
git log --oneline origin/main..HEAD
```

Trois cas :

| État trouvé | Alors |
|---|---|
| Arbre propre | Créer la branche (ci-dessous) |
| Modifications qui sont **cette** étape, déjà entamée | Proposer de reprendre sur la branche courante si son nom correspond et qu'elle part d'`origin/main`. Commiter l'existant par intention, en plusieurs commits, après lint, typecheck et tests, puis reprendre au §3 |
| Modifications d'un autre travail | S'arrêter et demander quoi en faire. Ne jamais les emporter dans la nouvelle branche |

- Créer la branche depuis `origin/main` à jour : `git switch -c feat/nom-court origin/main` (ou `fix/`, `docs/`). Nom en français, d'après l'étape.
- Si une autre session travaille déjà dans ce dossier, utiliser un worktree (`superpowers:using-git-worktrees`).

## 3. Concevoir, selon la taille

| L'étape… | Alors |
|---|---|
| touche la base (table, fonction, RLS) ou plusieurs couches, ou laisse un choix ouvert | `superpowers:brainstorming`, puis spec dans `docs/superpowers/specs/AAAA-MM-JJ-nom-design.md`, commitée seule : `ajoute la spec de …` |
| demande plus de 3 ou 4 commits | En plus, `superpowers:writing-plans`, plan dans `docs/superpowers/plans/` |
| est un correctif ou un changement local | Pas de spec : décrire l'approche en trois lignes et enchaîner |

La spec commence par le lot, les étapes, l'écran et les règles, comme les specs existantes. Chaque décision y figure avec son coût et les alternatives écartées. Quand plusieurs options existent : tableau comparatif avec le coût de chacune, puis attendre la décision de Gautier.

Les autres fichiers de `docs/` (architecture, modèle de données, glossaire, design system) : proposer la modification, la faire seulement sur accord.

## 4. Implémenter, couche par couche

Ordre : base, puis `packages/shared`, puis `apps/web`, puis parcours e2e. Chaque couche est testée avant de passer à la suivante.

| Couche | À faire |
|---|---|
| Base | Migration `supabase/migrations/AAAAMMJJHHMMSS_nom.sql`, fonctions commentées en français, entrées revérifiées, RLS. `supabase db reset`, tests pgTAP (deux utilisateurs pour la RLS, refus des entrées invalides), `supabase test db`. Puis `supabase gen types typescript --local > packages/shared/src/base.ts` |
| `shared` | Schémas Zod, rendu PDF avec pdf-lib. Tests Vitest d'abord |
| `web` | Appels `rpc`, écrans. Test de composant quand il y a une logique |
| e2e | Seulement si l'étape touche un parcours critique (création, import, composition, export) |

- Test d'abord (`superpowers:test-driven-development`). Un correctif commence par un test qui reproduit le bug.
- Un commit par intention, en français, à l'impératif, sans point final. `npm run lint && npm run typecheck && npm test` passe avant chaque commit.
- Commiter au fil de l'eau : une branche sans commit et vingt fichiers modifiés est un signal d'arrêt.
- Une dépendance nouvelle, une fonctionnalité non demandée, une abstraction pour plus tard : demander d'abord.

## 5. Essayer dans le navigateur

Si l'étape change un écran : lancer le serveur `web` de `.claude/launch.json`, rejouer le parcours de l'étape avec un compte créé par l'inscription (adresse en `@bookopia.test`, comme les e2e), regarder la console et le réseau. Une capture sert de preuve pour la PR. Si l'essai n'est pas possible, le noter : il ira dans « Non traité ».

## 6. Clore la branche

- Relire la spec : si l'implémentation s'en écarte, l'aligner (`aligne la spec de … sur l'implémentation`).
- Vérifier que tout est commité.
- Résumer à Gautier : critères couverts avec leur preuve, critères non couverts, écarts avec la spec. Puis proposer `/preparer-pr` avec les liens des étapes. C'est `/preparer-pr` qui lance la suite complète (pgTAP et e2e compris) et la revue par un agent indépendant : ne pas la doubler ici.

## Points d'arrêt

S'arrêter et attendre Gautier : changement de Statut Notion, flou dans les critères, choix entre options, spec à valider, dépendance, modification de `docs/` hors specs et plans, modifications non commitées trouvées au départ.

## Signaux d'alerte

| Situation | Ce qu'elle signale |
|---|---|
| Branche créée depuis une autre branche que `origin/main`, ou en retard | Conflits et diff illisible à la revue |
| Travail non commité qui s'accumule | Commits impossibles à séparer par intention |
| Deuxième étape ajoutée « pendant qu'on y est » | PR trop large : ouvrir une autre étape |
| « Pas essayé dans le navigateur » pour un changement d'écran | Le parcours n'est pas prouvé |
| Fusion d'une branche dans `main` en local | Interdit : `main` ne reçoit que des PR. Fusionner `origin/main` **dans** la branche reste permis |
| « On verra à la revue » pour un test manquant | La revue de `/preparer-pr` signale, elle n'écrit pas les tests |
