# Import des photos

Lot L3 · Import. Étapes 24 (envoi dans Storage puis ligne `photo`), 25 (envoi par lots, écran E5), 26 (préparation dans le navigateur), 32 (reprise d'un import interrompu). Écrans : E7 réduit à la réserve, E5 Importer des photos.

## Objectif

Le Créateur ouvre un livre, importe jusqu'à 300 photos, et les retrouve en vignettes dans la réserve du livre.

## Décisions

| Sujet | Décision | Coût assumé |
|---|---|---|
| Accroche de E5 | Un E7 réduit sur `/livre/:id` : titre, réserve en vignettes, bouton « Importer ». E5 est une surcouche sur `/livre/:id/import`. | Un écran de plus, que L4 et L6 compléteront |
| Après la création d'un livre | S1 mène sur `/livre/:id`. Chaque livre de E4 ouvre `/livre/:id`. | Aucun |
| Date de prise de vue | `exifr`, dépendance validée | Une dépendance sans sous-dépendance. `exifr` ne lit pas le WebP : `prise_le` reste vide pour ce format |
| Où tourne la préparation | Fil principal, trois fichiers à la fois. Un Web Worker pourra la reprendre sans toucher à l'envoi. | `drawImage` peut figer l'écran une cinquantaine de millisecondes par photo |
| Reprise | Par l'empreinte : on relit celles du livre avant l'envoi, la nouvelle sélection saute les fichiers déjà arrivés. Alerte `beforeunload` pendant l'envoi. Rien n'est gardé dans le navigateur. | L'état « Interrompu » de E5 n'est pas affiché au retour : on resélectionne, les fichiers déjà arrivés sont comptés comme tels |
| Doublons | Écartés avant préparation par l'ensemble des empreintes. L'unicité `(projet_id, empreinte_fichier)` reste la garantie. | Une requête par import |
| Taille de l'original | Plus petit facteur qui couvre encore chaque cadre photo du catalogue à 300 DPI, fond perdu de 3 mm compris. Jamais d'agrandissement. | Environ 5031 × 2551 px pour le cadre de 420 × 210 mm |
| Écritures | `photo` est écrite par `insert` direct, protégé par la RLS et les contraintes. Pas de fonction SQL : aucune règle à appliquer au-delà des contraintes. | Aucun |

## Découpage

**`packages/shared`**

- `tailleOriginal(largeurPx, hauteurPx, cadres)` → `{ largeur, hauteur }`. Pour chaque cadre photo, cible = `ceil((cote_mm + 6) / 25,4 × 300)` px sur chaque axe. Facteur = `min(1, max sur les cadres de max(cibleL / largeurPx, cibleH / hauteurPx))`. Le rendu PDF (L2) réutilisera le même calcul pour vérifier les 300 DPI.

**`apps/web/src/import/`**

| Fichier | Rôle |
|---|---|
| `filtrer.ts` | RG-01 (10 Mo au plus) et RG-02 (JPEG, PNG, WebP). Renvoie `{ acceptes, refuses: [{ fichier, raison }] }`. |
| `preparer.ts` | Empreinte SHA-256 (`crypto.subtle`), date (`exifr`), décodage (`createImageBitmap`), original JPEG qualité 0,9 à la taille de `tailleOriginal`, vignette de 480 px de côté long en WebP qualité 0,8, ou en JPEG si `blob.type` ne vaut pas `image/webp`. Libère le bitmap. |
| `envoyer.ts` | Clé neuve (`crypto.randomUUID()`), dépôt de l'original puis de la vignette, insertion de la ligne `photo`. Supprime les fichiers déposés si l'insertion échoue. |
| `importer.ts` | Orchestrateur : lit les empreintes du livre, traite la file trois fichiers à la fois, publie l'avancement. Reçoit `preparer` et `envoyer` en paramètres, pour les tests. |

**`apps/web/src/api/photos.ts`** : lister la réserve d'un livre, lire ses empreintes, créer une ligne `photo`, supprimer des fichiers, URL signées des vignettes (`createSignedUrls`, une heure).

**Écrans**

- `LivreEnCours.tsx` sur `/livre/:id` : loader (projet, photos, URL signées des vignettes), titre, grille des vignettes, bouton « Importer ».
- `ImportPhotos.tsx` sur `/livre/:id/import`, enfant de `/livre/:id` : la surcouche E5.

Les deux passent par `sousSession`.

## Flux

1. **Sélection** par le sélecteur ou par glisser-déposer. `filtrer` écarte tout de suite les refusés. Les autres attendent la confirmation.
2. **Lancement** : lecture de `empreinte_fichier` pour les photos du livre, mise en ensemble. Activation de l'alerte `beforeunload`.
3. **Pour chaque fichier**, trois à la fois :
   1. Empreinte. Si elle est dans l'ensemble : doublon, rien n'est envoyé. Sinon, elle y entre, ce qui écarte aussi les doublons internes à la sélection.
   2. Préparation.
   3. Dépôt de `{uid}/{projet}/originaux/{cle}.jpg` puis de `{uid}/{projet}/vignettes/{cle}.webp` (ou `.jpg`).
   4. Insertion de la ligne `photo`.
4. **Fin** : retrait de l'alerte, décompte (importées, doublons, refusées, en échec, avertissements). Le retour sur `/livre/:id` recharge la réserve.

## Erreurs

Une erreur porte sur un fichier, jamais sur la file.

| Cas | Conduite |
|---|---|
| Décodage impossible (RG-05) | Échec « fichier illisible ». Rien n'est envoyé, aucune ligne. |
| Dépôt refusé ou réseau coupé | Un nouvel essai, puis échec. Suppression du fichier déjà déposé, sans bloquer si elle échoue : un orphelin est accepté. |
| Insertion refusée par l'unicité (deux onglets) | Suppression des deux fichiers, compté comme doublon. |
| Autre refus à l'insertion | Suppression des deux fichiers, échec. |
| Session expirée | La file s'arrête, renvoi vers la connexion avec l'adresse demandée. |
| Moins de 1000 px de côté long | Importée, avec un avertissement dans le compte rendu. |

**Revérifié par le serveur (RG-03)** : type (JPEG ou WebP) et taille (20 Mo) par le bucket ; dossier `auth.uid()` par la règle Storage ; livre de la personne par la RLS de `photo` ; forme de l'empreinte, dimensions positives et unicité par les contraintes. Le serveur ne contrôle que le type annoncé. Les images étant recréées par le canvas, un fichier d'origine n'est jamais déposé tel quel.

## Interface

**E7 réduit (`/livre/:id`)**

- Titre du livre, lien de retour vers « Mes livres ».
- Réserve : grille de vignettes carrées, ordre d'import, nombre de photos.
- État vide : « Aucune photo pour l'instant », bouton principal « Importer des photos ».
- Bouton « Importer » vers `/livre/:id/import`.

**E5 (`/livre/:id/import`)**, dans une `Modale` large :

| État | Contenu |
|---|---|
| Vide | Zone de dépôt, « Glisse tes photos ici ou choisis-les », rappel JPEG, PNG, WebP, 10 Mo au plus |
| Sélection en attente | Nombre de fichiers retenus, bouton **Importer N photos** |
| Fichiers refusés | Liste des refusés avec la raison, au-dessus de la sélection retenue |
| Envoi n sur N | Barre de progression, fermeture désactivée. Pas de nom de fichier en cours : trois sont traités à la fois |
| Terminé | « N photos ajoutées à la réserve », doublons comptés à part, bouton **Voir la réserve** |
| Terminé avec échecs | Même chose, plus la liste des échecs avec leur raison |
| Doublons rejetés | Ligne « N déjà dans le livre », sans liste |

L'état « Interrompu » se résume à la reprise par l'empreinte (voir Décisions). « Attente Google » relève de L8, hors périmètre.

## Hors périmètre

- Web Worker de préparation.
- Purge des fichiers orphelins.
- Suppression d'une photo de la réserve, cadrage, pose dans un emplacement (L4, L6).
- Import depuis Google Photos (L8).

## Tests

| Niveau | Contenu |
|---|---|
| Vitest | `tailleOriginal` : jamais d'agrandissement, cadre le plus exigeant retenu, photo portrait et paysage, fond perdu compris. `filtrer` : taille, types, SVG et HEIC refusés. `importer` avec `preparer` et `envoyer` simulés : doublons du livre et de la sélection, échec isolé, décompte, trois au plus en même temps. Écrits avant le code. |
| pgTAP | Rien de nouveau : l'insertion dans le livre d'un autre et l'unicité sont couvertes. Relancés. |
| Playwright | Créer un livre, arriver sur `/livre/:id`, importer deux images de test (dont une en double), voir une vignette et « 1 déjà dans le livre ». |
| Manuel | Safari : vignette en JPEG si le WebP n'est pas encodé. Import de 300 photos : mémoire stable, interface utilisable. Fermer l'onglet pendant l'envoi : alerte, puis reprise par resélection. |
