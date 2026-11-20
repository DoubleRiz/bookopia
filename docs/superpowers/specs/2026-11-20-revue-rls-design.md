# Revue des RLS, droits d'exécution et contrôle des dépôts

Lot L9 · Sécurité & tests. Étapes BK-048 (revue des RLS, chaque table, chaque opération), BK-118 (test pgTAP des droits d'exécution des fonctions), BK-120 (Storage : quotas et contrôle des fichiers déposés). Écran : E5 Importer des photos, pour le plafond.

## Objectif

Prouver que chaque accès aux données passe par une règle justifiée, et qu'une fonction ou une table ajoutée plus tard ne peut pas l'oublier sans casser un test. Fermer les deux trous constatés le 2026-11-12 dans le stockage : le dépôt sous un livre qui n'est pas le sien, et l'absence de plafond de photos.

## Constat

La revue des migrations montre une base déjà conforme :

- les 9 tables de `public` ont la RLS activée ;
- chaque policy compare sur une colonne indexée (voir le tableau) ;
- chaque fonction `security definer` fixe `search_path = ''` et revérifie ses entrées ;
- chaque migration qui crée une fonction révoque l'exécution à `public` et `anon`.

Rien ne le vérifie en revanche : une migration future peut oublier un `revoke` ou un `enable row level security`. Les trous réels sont dans Storage :

- la règle de dépôt ne vérifie que le premier dossier (`auth.uid()`) : un Créateur peut déposer sous n'importe quel `projet_id`, y compris inventé ;
- aucun plafond de photos par livre.

## Décisions

| Sujet | Décision | Coût assumé | Écarté |
|---|---|---|---|
| Plafond de photos | **100 photos par livre**, sans plafond par Créateur | L'offre gratuite de Supabase donne 1 Go de fichiers pour tout le projet. Un original pèse 3 à 5 Mo (JPEG 0,9, au plus environ 5030 px de côté long), une vignette environ 40 Ko, un PDF jusqu'à 50 Mo : un livre plein occupe 350 à 550 Mo. Deux ou trois livres pleins remplissent le quota. Acceptable pour un MVP de démonstration avec peu de comptes | 100 par livre + 200 par Créateur : un test de plus, ne protège pas de plusieurs comptes. 1 livre par Créateur : change E4, hors périmètre |
| Où vit le plafond | Trigger `before insert` sur `photo` en base (la garantie), et vérification dans l'import (l'économie de stockage) | La valeur 100 est écrite deux fois : dans la migration et dans `packages/shared`. Un test de chaque côté la fige | Base seule : le navigateur dépose les fichiers avant la ligne `photo`, chaque refus laisserait deux fichiers orphelins (environ 4 Mo). Compter dans la règle Storage : requête lente sur `storage.objects`, deux fichiers par photo, message illisible |
| Verrou du plafond | Le trigger verrouille la ligne `projet` (`verrouiller_projet`) avant de compter | Deux imports simultanés du même livre passent l'un après l'autre, ligne par ligne | Compter sans verrou : deux onglets peuvent dépasser 100 |
| Deuxième dossier | La règle de **dépôt** exige que le deuxième dossier soit un livre du Créateur, via `est_mon_projet`. Lecture et suppression restent sur le premier dossier seul | Un fichier d'un livre supprimé reste lisible et supprimable par son Créateur : c'est voulu, la purge (BK-126) et la suppression du compte (BK-123) en ont besoin | Vérifier aussi la lecture et la suppression : les fichiers d'un livre supprimé deviendraient impossibles à retirer |
| Dossier qui n'est pas un uuid | Refusé sans erreur de conversion : `case when … ~ '<uuid>' then est_mon_projet(…::uuid) else false end` | Une expression régulière dans la règle | Un `and` : PostgreSQL ne garantit pas l'ordre d'évaluation, le cast peut lever `22P02` |
| Tableau des policies | Dans cette spec, section suivante | `docs/architecture.md` ne le reprend pas sans accord | |
| Preuve « aucune table sans RLS » | Requête sur `pg_class.relrowsecurity` dans `autorisations_test.sql` | Aucun | Une requête à lancer à la main : ne protège pas l'avenir |

## Tableau des policies (BK-048)

`anon` = visiteur, `authenticated` = Créateur connecté. « Droit » est le `grant` (quelles colonnes), « Policy » est la RLS (quelles lignes). Une case « — » : ni droit ni policy, l'opération est refusée.

| Table | Lecture | Création | Modification | Suppression | Index utilisé |
|---|---|---|---|---|---|
| `modele_livre` | anon et authenticated, toutes les lignes : catalogue public, montré avant l'inscription | — | — | — | |
| `theme`, `gabarit` | authenticated, toutes les lignes : catalogue | — | — | — | |
| `utilisateur` | `id = auth.uid()` | — (trigger d'inscription, `security definer`) | `nom_affichage` seul, `id = auth.uid()` | — (cascade depuis `auth.users`) | clé primaire |
| `projet` | `utilisateur_id = auth.uid()` | — (`creer_projet` : un livre naît avec couverture et 4e) | `titre`, `brouillon`, `utilisateur_id = auth.uid()` | `utilisateur_id = auth.uid()` | `projet_utilisateur_id_modifie_le_idx` |
| `double_page` | `est_mon_projet(projet_id)` | — (fonctions d'ordre : le rang reste sans trou) | — | — | `double_page_projet_id_position_idx` |
| `emplacement` | `est_mon_projet(projet_id)` | — (copié du gabarit par les fonctions) | `photo_id`, cadrage, `contenu_texte`, `est_mon_projet(projet_id)` ; la géométrie reste celle du gabarit | — | `emplacement_projet_id_idx` |
| `photo` | `est_mon_projet(projet_id)` | colonnes de la photo, `est_mon_projet(projet_id)`, **au plus 100 par livre** (trigger) | — (une photo ne change pas) | `est_mon_projet(projet_id)` | `unique (projet_id, empreinte_fichier)` |
| `export` | `est_mon_projet(projet_id)` | `projet_id`, `cle_stockage`, `est_mon_projet(projet_id)` | idem, `using` et `with check` : un upsert ne peut pas déplacer l'export vers le livre d'un autre | `est_mon_projet(projet_id)` | `unique (projet_id)` |
| Storage `photos`, `exports` | 1er dossier = `auth.uid()` | 1er dossier = `auth.uid()` **et 2e dossier = un livre du Créateur** ; taille et type bornés par bucket | — (chaque dépôt prend une clé neuve) | 1er dossier = `auth.uid()` | |

`est_mon_projet` est `security definer` pour lire `projet` sans repasser par sa RLS. Elle cherche par clé primaire et compare `utilisateur_id` à `(select auth.uid())`, évalué une fois par requête.

## Découpage

**Base**

- Migration `20261120100000_controle_depots.sql` :
  - fonction trigger `verifier_plafond_photos()`, `security definer`, `search_path = ''`, commentée. Elle appelle `verrouiller_projet(new.projet_id)`, compte les photos du livre et lève `raise exception 'plafond' using detail = 'Un livre compte au plus 100 photos'` à partir de 100. Exécution révoquée à `public`, `anon`, `authenticated` ;
  - trigger `before insert` sur `photo` ;
  - la policy « Un créateur dépose ses fichiers » est remplacée par une version qui vérifie aussi le deuxième dossier.
- `supabase/tests/privileges_fonctions_test.sql` (BK-118) :
  - aucune fonction de `public` exécutable par `anon` (`has_function_privilege`) ;
  - les fonctions de `public` exécutables par `authenticated` sont exactement la liste blanche : `est_mon_projet`, `creer_projet`, `inserer_double_page`, `deplacer_double_page`, `supprimer_double_page`, `dupliquer_double_page`, `remplir_emplacements`, `composer_livre`, `changer_gabarit`, `changer_theme`, `segments_texte_valides`, `contenu_texte_valide`, `placer_cadre_texte` (signatures complètes, `regprocedure`) ;
  - aucune fonction `security definer` de `public` sans `search_path` dans `proconfig` ;
  - les fonctions qui appartiennent à une extension (`pg_depend`, `deptype = 'e'`) sont exclues, pgTAP compris.
- `supabase/tests/autorisations_test.sql` :
  - toute table de `public` a `relrowsecurity` ;
  - le dépôt existant passe sous le vrai `projet_id` d'Alice ;
  - Alice ne dépose ni sous le livre de Bob dans son propre dossier, ni sous un dossier qui n'est pas un uuid ;
  - même vérification pour le bucket `exports`.
- Test du plafond (dans `fonctions_metier_test.sql` ou un fichier à part, au choix de l'implémentation) : 100 photos passent, la 101e lève `plafond` ; une suppression libère une place.

**`packages/shared`**

- Constante `PHOTOS_PAR_LIVRE_MAX = 100`, exportée.

**`apps/web`**

- `importer.ts` : les empreintes déjà lues donnent le nombre de photos du livre. Chaque fichier nouveau (ni doublon ni refusé par le filtre) réserve une place avant sa préparation ; sans place, il finit en échec de raison `plafond`, sans être préparé ni déposé. Une erreur `plafond` renvoyée par la base (autre onglet) donne la même raison, via une `ErreurPlafond` levée par `envoyer.ts` sur le modèle d'`ErreurDoublon`. Les fichiers déjà déposés sont supprimés par le `catch` existant d'`envoyer.ts`, comme pour tout échec d'insertion.
- `ImportPhotos.tsx` : libellé de la raison `plafond` : « Livre complet (100 photos) ».
- Tests Vitest de `importer` : avec 98 photos et 5 fichiers nouveaux, 2 importés et 3 en `plafond`, aucun préparé au-delà ; les doublons ne consomment pas de place.

## Hors périmètre, à signaler

- La spec d'import du 2026-10-07 annonce « jusqu'à 300 photos » : elle sera alignée sur 100 dans cette branche.
- BK-054 prévoit un jeu de démonstration de 300 photos : il ne tient plus dans un livre. À revoir dans Notion par Gautier.
- `docs/architecture.md` (« Les fichiers ») ne parle pas du plafond ni du deuxième dossier : modification proposée, faite seulement sur accord.
- Le quota global de 1 Go n'est pas protégé par ce plafond.

## Laissé à l'implémentation

- Le nom exact du fichier de test du plafond.
- Le contrôle du deuxième dossier peut passer par une petite fonction `est_mon_dossier_projet(text)` si l'expression `case` rend la policy illisible ; elle entre alors dans la liste blanche et dans le tableau.
