---
description: Vérifie une branche (critères d'acceptation Notion, tests, revue) puis ouvre sa PR
argument-hint: "[liens ou titres des étapes Notion]"
---

Prépare la PR de la branche courante vers `main`. Le processus est décrit dans `docs/conventions.md`, section « Revue et intégration ». Chaque étape s'arrête sur un échec : on ne passe pas à la suite avec un test rouge ou une remarque bloquante non traitée.

Étapes Notion indiquées : $ARGUMENTS

## 1. État de la branche

- Refuser de continuer sur `main` : proposer de créer une branche `feat/…`, `fix/…` ou `docs/…`.
- Vérifier que le travail est commité. S'il reste des modifications, demander quoi en faire.
- Récupérer `origin/main` et regarder si la branche est en retard. Si oui, proposer de fusionner `main` dans la branche avant de vérifier.
- Lire le diff complet : `git diff origin/main...HEAD`.

## 2. Étapes Notion et critères d'acceptation

- Les étapes vivent dans la base « 🗺️ Suivi du projet » (`collection://5be075ee-cce9-45b6-be65-542444a51a8d`). Si aucune n'est indiquée, chercher dans cette base celles qui correspondent au diff, puis faire confirmer la liste.
- Lire chaque étape : sa section « Critères d'acceptation », son Livrable et l'écran visé (spécifications E0 à E10).
- Pour chaque critère, chercher la preuve : un test qui le couvre, un résultat de commande, un essai dans le navigateur. Classer chaque critère en **vérifié** (avec sa preuve) ou **non vérifié** (avec la raison). Ne jamais présenter un critère comme rempli sans preuve.
- Un critère que le diff ne couvre pas est signalé, pas ignoré.

## 3. Tests

Lancer, et rapporter les résultats exacts :

```bash
npm run lint && npm run typecheck && npm test
supabase test db
npm run e2e
```

Les deux dernières commandes demandent `supabase start`. Vérifier aussi :

- Une nouvelle règle métier ou un nouveau comportement a son test. Un correctif a un test qui reproduit le bug.
- Une nouvelle table ou fonction SQL a ses tests pgTAP (RLS avec deux utilisateurs, refus des entrées invalides).
- Si une migration change le schéma, `packages/shared/src/base.ts` a été régénéré.

## 4. Revue du code

Faire relire le diff par un sous-agent qui n'a pas écrit le code. Lui donner le diff et `CLAUDE.md`, pas tes conclusions. Utiliser `/code-review` s'il est disponible. Il contrôle :

- La correction : cas limites, erreurs non gérées, concurrence des écritures.
- Les règles non négociables de `CLAUDE.md` : vocabulaire métier français, règles métier dans Supabase, RLS sur toute table, entrées revérifiées dans chaque fonction SQL, pdf-lib pour le PDF.
- Le périmètre : aucune fonctionnalité non demandée, aucune abstraction hypothétique, aucune dépendance ajoutée sans validation.
- Les conventions : nommage, commentaires en français qui expliquent le pourquoi, commits à l'impératif.

Présenter les remarques classées par gravité. Corriger celles que l'utilisateur retient, puis relancer les tests concernés.

## 5. Ouvrir la PR

- Montrer le titre et la description, puis attendre l'accord de l'utilisateur.
- Remplir `.github/pull_request_template.md` avec les liens des étapes Notion, les critères et leurs preuves, ce qui a tourné et ce qui n'est pas traité.
- `git push -u origin <branche>` puis `gh pr create --base main --body-file <fichier>`.

## 6. Mettre à jour Notion

Avec l'accord de l'utilisateur, sur chaque étape :

- Cocher les critères **vérifiés**, et eux seulement.
- Ajouter aux Notes : « PR #n ouverte (date) », avec ce qui reste à vérifier.
- Laisser le Statut sur « En cours ». `/fusionner-pr` le passe à « Terminé ».

Terminer par le lien de la PR et l'état des vérifications de la CI (`gh pr checks`).
