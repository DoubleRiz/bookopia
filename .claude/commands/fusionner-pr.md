---
description: Fusionne une PR dont la CI est verte, puis passe ses étapes Notion à « Terminé »
argument-hint: "[numéro de PR]"
---

Fusionne la PR $ARGUMENTS (par défaut, celle de la branche courante) dans `main`. Le processus est décrit dans `docs/conventions.md`, section « Revue et intégration ».

1. `gh pr view` : lire la description, les étapes Notion liées et la section « Non traité ».
2. `gh pr checks` : toutes les vérifications doivent être vertes. Si une vérification tourne encore, le dire et s'arrêter. Si une vérification échoue, lire son journal (`gh run view --log-failed`), en donner la cause et s'arrêter. Ne jamais contourner la protection de `main`.
3. Si GitHub signale que la branche est en retard sur `main`, la mettre à jour (`gh pr update-branch`). La CI se relance : s'arrêter et attendre qu'elle soit verte.
4. Résumer ce qui va être fusionné et ce qui reste non traité, puis attendre l'accord de l'utilisateur.
5. `gh pr merge --merge --delete-branch`.
6. Avec l'accord de l'utilisateur, sur chaque étape Notion liée :
   - Statut « Terminé » si tous les critères sont cochés. Sinon, laisser « En cours » et lister les critères qui restent.
   - Notes : remplacer « PR #n ouverte » par « Fait (date, PR #n) », suivi de ce qui reste à vérifier à la main.
7. Revenir sur `main` et le mettre à jour (`git switch main && git pull`).
