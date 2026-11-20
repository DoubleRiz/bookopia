# Données du Créateur : suppression du compte, purge des fichiers orphelins, entrées des fonctions

Lot L9 · Sécurité & tests. Étapes BK-123 (suppression du compte), BK-126 (purger les fichiers orphelins du stockage), BK-048 (reste : prouver par un test que les entrées des fonctions `security definer` sont revérifiées). Écran touché : le minimum, un bouton de suppression du compte avec confirmation (l'écran exact est à fixer avec la décision 1). Règles : « la clé `service_role` n'est jamais utilisée par l'application » (`CLAUDE.md`), « les règles métier vivent dans Supabase ».

**Statut : décisions validées par Gautier le 2026-11-20** (option A pour BK-123 et BK-126, délai de 24 h, bouton en bas de E4 ; décision 3 retenue telle quelle). Implémenté.

## Objectif

Que le Créateur puisse effacer ses données (RGPD, droit à l'effacement) sans qu'il en reste en base ni dans Storage, et que les fichiers sans ligne ne s'accumulent pas. Prouver que les fonctions `security definer` ne font pas confiance à leurs arguments.

## Constat : ce que la base sait et ne sait pas faire

**Essai du 2026-11-20 sur la pile locale (Storage v1.96.0, backend `file`).** Un fichier a été déposé dans le bucket `photos` par l'API Storage, puis supprimé par SQL.

| Étape | Résultat |
|---|---|
| `delete from storage.objects where name like …` | **Refusé** : `Direct deletion from storage tables is not allowed. Use the Storage API instead.` (trigger `storage.protect_delete`, code `42501`) |
| Même suppression avec `set_config('storage.allow_delete_query', 'true', true)` | La ligne disparaît (`DELETE 1`) |
| Fichier sur le disque du conteneur Storage après cette suppression | **Toujours là** (`/mnt/stub/stub/photos/…`) |
| Lecture par l'API après cette suppression | `404` : le fichier est devenu **invisible et irrécupérable** par l'application, mais occupe encore la place |

Conséquences :

- Une suppression SQL n'efface que les métadonnées. Pire que l'orphelin qu'on veut purger : le fichier perd même sa ligne et ne peut plus être listé ni retiré par l'API.
- La base ne peut donc **pas** supprimer elle-même un fichier. Seule l'API Storage le fait (`remove`), avec un jeton qui passe la règle de suppression de `storage.objects` (premier dossier = `auth.uid()`) ou avec `service_role`.
- La base sait en revanche **lister** précisément les orphelins (comparaison de `storage.objects` avec `photo.cle_stockage` et `export.cle_stockage`) et **refuser** une opération tant qu'il reste des fichiers.

Le fichier de l'essai a été retiré du disque à la main ; aucune donnée du projet n'a été touchée.

## Décision 1 : comment supprimer le compte (BK-123)

`auth.users` se supprime en SQL (la cascade vers `utilisateur`, `projet` et leur contenu existe déjà, `creer_tables.sql`). Les fichiers exigent l'API Storage. Trois façons de les relier :

| Option | Principe | Coût | Verdict |
|---|---|---|---|
| **A. Fonction SQL + navigateur qui vide d'abord** (recommandée) | Le navigateur liste et supprime les fichiers du Créateur par l'API Storage (règle existante : son dossier). Puis il appelle `rpc('supprimer_mon_compte')`, fonction `security definer` qui **refuse tant qu'il reste une ligne dans `storage.objects` à son nom**, puis supprime sa ligne `auth.users`. Le navigateur termine par `signOut` | Deux temps : si l'onglet se ferme après le vidage des fichiers, le compte existe encore (sans fichiers) ; le Créateur recommence et ça passe. Aucune clé privilégiée. Le test pgTAP prouve « rien en base » et « refus tant qu'un fichier existe » ; la preuve physique des fichiers se fait par un essai à la main (même méthode que ci-dessus) | Respecte `CLAUDE.md` : règle dans la base, pas de serveur, pas de `service_role` |
| B. Edge Function | Une fonction Edge reçoit le jeton, appelle `auth.admin.deleteUser` et `storage.remove` avec `service_role` | Un second runtime à déployer et tester ; la clé `service_role` existe côté serveur (hors de l'application, mais contraire à l'esprit de la règle 3) ; la règle métier sort de la base ; test pgTAP impossible, il faut un e2e. Atomicité à peine meilleure : l'API Storage et `auth` ne partagent pas de transaction | Écartée : coût supérieur pour le même résultat |
| C. Fonction SQL seule, puis purge des fichiers plus tard | `supprimer_mon_compte()` supprime le compte sans vérifier les fichiers ; la purge de BK-126 les retire un jour | Les fichiers restent sans propriétaire, sans moyen de les retirer par un jeton (la règle de suppression exige le dossier du Créateur, qui n'existe plus) : retour à l'orphelin irrécupérable sauf `service_role` | Écartée : viole le critère « fichiers supprimés avec le compte » |

Le critère « la clé `service_role` n'est pas utilisée par l'application » est tenu par A de fait : la clé n'est ni dans le front ni dans une fonction.

Détail de A :

- `supprimer_mon_compte()` : `security definer`, `search_path = ''`, commentée, révoquée à `public` et `anon`, accordée à `authenticated`. Entrées revérifiées : sans `auth.uid()` (appel anonyme) elle lève `42501` ; elle ne prend **aucun argument**, le compte visé est toujours celui du jeton, ce qui supprime toute usurpation par paramètre.
- Elle ajoute une entrée à la liste blanche de `privileges_fonctions_test.sql` (13 fonctions).
- Le propriétaire de la fonction doit pouvoir supprimer dans `auth.users` : à vérifier à l'implémentation (`postgres` y a le droit sur Supabase ; sinon la décision revient ici).
- Web : `supprimerCompte()` dans `api/authentification.ts` (liste récursive des deux buckets sous `{auth.uid()}/`, `remove` par lots, `rpc`, `signOut`), et un bouton « Supprimer mon compte » avec confirmation dans l'interface. Où placer le bouton : voir « Point à trancher » ci-dessous.

## Décision 2 : comment purger les fichiers orphelins (BK-126)

Un orphelin est un fichier de `storage.objects` dont la clé n'est référencée par aucune ligne : `photo.cle_stockage` pour `photos` (original et vignette partagent la clé, seuls le dossier et l'extension changent), `export.cle_stockage` pour `exports`. Trois sources : l'onglet fermé entre dépôt et ligne (`architecture.md`, « Les fichiers »), les PDF remplacés à chaque export (une clé neuve à chaque dépôt), et les fichiers d'un livre supprimé (cascade sur `photo`).

| Option | Principe | Coût | Verdict |
|---|---|---|---|
| **A. Liste en SQL, suppression par le navigateur** (recommandée) | `lister_fichiers_orphelins()`, `security definer`, renvoie `(bucket, chemin)` des orphelins **du Créateur connecté** plus vieux que le délai. Le navigateur les supprime par l'API Storage à l'ouverture de la liste des livres | Pas d'automatisme : un Créateur qui ne revient jamais garde ses orphelins (quelques Mo ; le quota global de 1 Go reste le vrai plafond, voir `revue-rls`). La suppression du compte vide le reste. Aucune clé privilégiée, aucune tâche planifiée | Cohérente avec la décision 1 et avec `CLAUDE.md` |
| B. Tâche planifiée (`pg_cron` + `pg_net` vers l'API Storage) | La base appelle l'API Storage avec `service_role` stockée dans le coffre | Purge réellement automatique, mais la clé `service_role` entre dans la base, `pg_net` et `pg_cron` s'ajoutent à la pile locale, difficile à tester en pgTAP | Écartée : viole l'esprit de la règle 3 |
| C. `delete from storage.objects` en SQL | Voir « Constat » | Métadonnées seules : le fichier reste sur le disque, invisible et irrécupérable | **Écartée par l'essai** |

**Délai : 24 heures** (proposition). Une importation de 100 photos dépose ses fichiers avant de créer les lignes ; même sur une connexion lente elle ne dure pas des heures. Au bout de 24 h, un fichier sans ligne est abandonné de façon certaine. Coût : un orphelin occupe jusqu'à 24 h de plus que nécessaire (4 Mo par photo ratée, négligeable). Un délai plus court (1 h) risquerait de supprimer un fichier en cours d'import ; plus long (7 jours) retarderait la libération du quota sans bénéfice. À justifier dans `docs/architecture.md` (critère de BK-126) : modification proposée, faite seulement sur accord, avec la phrase « Pas de purge automatique » à corriger en même temps.

Détail de A :

- `lister_fichiers_orphelins()` : `security definer`, `search_path = ''`, sans argument, `auth.uid()` obligatoire (`42501` sinon), ne voit que les fichiers dont le premier dossier est le Créateur. Compare l'uuid extrait du nom (`storage.filename`, sans extension) aux clés ; `created_at` de `storage.objects` pour le délai. Accordée à `authenticated` : 14e entrée de la liste blanche.
- Test pgTAP (critère « aucun fichier encore référencé n'est touché ») : un fichier référencé et plus vieux que le délai n'est pas listé ; un orphelin récent n'est pas listé ; un orphelin ancien l'est ; les fichiers d'un autre Créateur ne sont jamais listés.
- Web : `purgerOrphelins()` dans `api/photos.ts`, appelée à l'ouverture de la liste des livres, sans bloquer l'écran ni afficher d'erreur (échec silencieux, rejoué à la visite suivante).

## Décision 3 : test des entrées des fonctions `security definer` (BK-048, reste)

Le dernier critère de BK-048 demande que les entrées soient vérifiées ; la revue de la spec précédente les a relues sans manque, mais aucun test ne le prouve. Nouveau fichier `supabase/tests/entrees_fonctions_test.sql` :

- **Couverture** : un contrôle structurel échoue si une fonction `security definer` exécutable par `authenticated` (liste blanche de `privileges_fonctions_test.sql`) n'a pas de cas dans ce fichier. Une fonction ajoutée plus tard casse donc ce test jusqu'à ce qu'on écrive son cas.
- **Cas** : pour chaque fonction appelée par `rpc`, trois appels avec le jeton de l'utilisateur Alice : identifiant du livre ou de la double page **de Bob** (refus, `throws_ok`), identifiant **inexistant** (refus), argument **invalide** (valeur hors borne, `null`). Pour `supprimer_mon_compte` et `lister_fichiers_orphelins` : appel **sans jeton** refusé.
- Les cas déjà couverts par `fonctions_metier_test.sql` ou `composer_livre_test.sql` ne sont pas dupliqués : le fichier les référence dans un commentaire et ne teste que le manque. Le listing exact sera fait à l'implémentation.

Coût : un fichier de test de plus (une trentaine d'assertions), aucune migration. Alternative écartée : un seul contrôle structurel (« chaque fonction contient un test sur `auth.uid()` » lu dans `prosrc`) : il lit du texte, pas un comportement, et passe sur une vérification mal placée.

## Point à trancher : où mettre le bouton « Supprimer mon compte »

Il n'existe pas d'écran de compte dans les spécifications E0 à E10 ; l'étape ne le dit pas non plus. Options : (a) une ligne en bas de la liste des livres (E4), la plus petite ; (b) une page « Mon compte » dédiée, plus propre mais un écran de plus. Je propose **(a)**, avec une modale de confirmation qui reprend le composant `Modale` existant et exige de taper le mot « supprimer ». Les spécifications fonctionnelles priment : à confirmer par Gautier avant l'écran.

## Découpage de l'implémentation (après validation)

**Base**

- Migration `AAAAMMJJHHMMSS_donnees_du_createur.sql` : `supprimer_mon_compte()`, `lister_fichiers_orphelins()`, commentées en français ; `revoke … from public, anon`, `grant … to authenticated`.
- `privileges_fonctions_test.sql` : liste blanche portée à 14 fonctions.
- `supprimer_compte_test.sql` : sans jeton refusé ; avec un fichier au nom du Créateur, refusé ; sans fichier, la ligne `auth.users` disparaît et plus rien du Créateur dans `utilisateur`, `projet`, `double_page`, `emplacement`, `photo`, `export` ; un autre Créateur n'est pas touché.
- `purge_orphelins_test.sql` : les quatre cas de la décision 2.
- `entrees_fonctions_test.sql` : décision 3.
- Types régénérés : `supabase gen types typescript --local > packages/shared/src/base.ts`.

**`apps/web`** : les deux fonctions d'API, le bouton et sa modale, les tests Vitest (le vidage par lots, l'échec silencieux de la purge, la confirmation obligatoire). Essai navigateur : créer un compte `@bookopia.test`, importer, supprimer le compte, vérifier le disque du conteneur Storage.

**Aucun changement dans `packages/shared`.**

## Critères

| Étape | Critère | Couvert par |
|---|---|---|
| BK-123 | Supprimer `auth.users` supprime en cascade | Déjà coché ; vérifié dans `supprimer_compte_test.sql` |
| BK-123 | Suppression depuis l'application, après confirmation | Bouton, modale, test de composant |
| BK-123 | Fichiers des deux buckets supprimés | Vidage par l'API avant la fonction, refus de la fonction tant qu'il en reste, essai physique |
| BK-123 | `service_role` non utilisée | Option A : ni front ni fonction |
| BK-123 | Test : rien en base ni dans Storage | `supprimer_compte_test.sql` (base et lignes Storage), essai physique pour les octets |
| BK-126 | Orphelin plus vieux que le délai supprimé | `lister_fichiers_orphelins` + `purgerOrphelins` |
| BK-126 | Délai justifié dans `architecture.md` | Proposition de texte, sur accord |
| BK-126 | Fichier référencé jamais touché | `purge_orphelins_test.sql` |
| BK-048 | Entrées des fonctions `security definer` vérifiées | `entrees_fonctions_test.sql` |

## Écarts avec l'implémentation et preuves

- Le bouton est une section « Mon compte » sous la liste de E4 (`MesLivres.tsx`), la modale est `SupprimerCompte.tsx`.
- `entrees_fonctions_test.sql` : 34 assertions. Le contrôle de couverture liste 12 fonctions (les 10 de la liste blanche qui sont `security definer`, plus les deux nouvelles). `privileges_fonctions_test.sql` passe à 14 fonctions autorisées.
- **Essai de bout en bout, par l'API** (même suite d'appels que le front), compte `@bookopia.test` : trois fichiers déposés (original, vignette, PDF) ; la fonction refuse (`fichiers`) tant qu'ils existent ; `lister_fichiers_orphelins` les liste une fois vieillis à 48 h ; après suppression par l'API Storage, le disque du conteneur Storage passe de 3 fichiers à 0 ; `supprimer_mon_compte` rend 204 et plus rien du compte ne reste dans `auth.users`, `utilisateur`, `projet` ni `storage.objects`.
- **Non essayé dans le navigateur** : la session n'était ouverte dans aucune fenêtre, la page ne s'affichait pas. Le parcours de l'écran (saisie du mot, bouton inactif, redirection) est couvert seulement par le test de rendu et le typecheck.

## Hors périmètre, à signaler

- `docs/architecture.md` (« Les fichiers », « Pas de purge automatique ») : modification proposée, non faite.
- Un Créateur qui supprime un livre laisse ses fichiers orphelins jusqu'à la prochaine purge (24 h minimum) : acceptable, voulu par la décision 2.
- La purge ne protège pas du quota global de 1 Go (voir `2026-11-20-revue-rls-design.md`).
- Le tableau de suivi Notion (statuts, cases à cocher) n'est pas modifié sans accord.
