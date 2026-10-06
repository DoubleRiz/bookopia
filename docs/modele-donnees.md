# Modèle de données

Le schéma Prisma (`packages/db/prisma/schema.prisma`) fait foi pour les types exacts. Ce document porte les **invariants et les justifications** qu'un schéma ne peut pas exprimer.

## Vue d'ensemble

```
Utilisateur
 └── Projet                  (0..n)
      ├── Photo              (0..n)
      ├── Export             (0..1)
      └── DoublePage         (2..n : couverture, 4e, intérieures ordonnées)
           └── Emplacement   (1..n, créés depuis le gabarit)
                └── Photo    (0..1, référence)

Gabarit      — donnée de référence, hors arbre projet
Theme        — donnée de référence, hors arbre projet
ModeleLivre  — donnée de référence, hors arbre projet
```

L'arbre est strictement hiérarchique et **rien n'est partagé entre utilisateurs**. C'est ce qui rend l'autorisation triviale : une ligne est accessible si elle appartient à un projet dont l'appelant est propriétaire.

---

## Principe fondateur

> **Ce qui casse les données existantes quand on le modifie est copié ; ce qui les améliore est référencé.**

- La **géométrie du gabarit** est **copiée** dans les emplacements à la pose. Modifier un gabarit ne doit pas déplacer les photos d'un livre déjà composé.
- Le **thème** est **référencé**. Corriger une couleur mal contrastée doit bénéficier à tous les projets.
- Les valeurs d'un **modèle de livre** sont **copiées** dans le projet à sa création.

---

## Entités

### Utilisateur

`id`, `email` (unique), `motDePasseHache` (argon2id), `nomAffichage`, `creeLe`.

Un seul champ de nom : aucun usage ne sépare prénom et nom. Supprimer un compte supprime en cascade ses projets, leurs photos et les fichiers correspondants.

**Pas de table de jetons** : l'authentification repose sur un JWT seul, sans révocation côté serveur.

### Projet

`id`, `utilisateurId`, `titre`, `themeId`, `brouillon` (booléen, vrai par défaut), `modeleOrigineId`, `creeLe`, `modifieLe`.

- **Pas de champ format** : le format est unique et l'information vit déjà dans les dimensions des gabarits. Un champ à valeur unique ment sur le modèle.
- **Pas de compteur** de pages ni de photos : ça se calcule, et un compteur stocké se désynchronise.
- **`brouillon` est une intention, pas un avancement** : le Créateur le lève ou le remet, ni l'export ni la composition n'y touchent. Les avancements (vide, exporté…) se calculent.
- **Pas d'état de rendu** : « en cours de rendu » décrit un traitement, pas une intention. Sa place est dans `Export`.
- **`modeleOrigineId` est informatif** : personne ne relit le modèle après la création. Il passe à `NULL` si le modèle est supprimé.

### Photo

Rattachée au **projet**, pas à l'utilisateur : deux livres partageant une photo la stockent deux fois.

`id`, `projetId`, `cleStockage`, `nomFichierOrigine`, `empreinteFichier` (SHA-256, **unique par projet**, bloque les doublons stricts), `largeurPx`, `hauteurPx`, `priseLe` (EXIF, peut être vide), `sourceType` (`upload` | `google_photos`), `creeLe`.

**Une photo n'existe en base qu'une fois traitée** : le traitement est synchrone à l'import, il n'y a ni état de traitement, ni motif d'échec, ni reprise. Un fichier illisible n'est pas créé, son nom est renvoyé au front. → [`architecture.md`](architecture.md#limport)

`Photo` ne garde que ce qui décrit le fichier : ni scores, ni empreinte perceptuelle, ni suggestions — la curation est retirée du périmètre.

`nomFichierOrigine` permet au Créateur de retrouver une photo. `cleStockage` est un identifiant opaque et doit le rester.

La **résolution insuffisante n'est jamais un échec**, seulement un avertissement. Les fichiers trop lourds et les formats refusés sont arrêtés **à la sélection**, avant tout envoi, et l'API revérifie.

### Gabarit

Donnée de référence, créée par un script d'initialisation. Lecture pour tous, écriture pour personne.

`id`, `nom`, `role` (`couverture` | `interieur` | `quatrieme`), `famille`, `definition` (JSON), `actif`.

Un cadre : `{ indice, x, y, largeur, hauteur, nature: "photo" | "texte" }`, en **millimètres**. Un cadre à cheval sur le pli se lit dans sa géométrie, il n'est pas marqué.

`famille` regroupe les gabarits d'un même esprit : une colonne, pas de table de liaison. Le moteur de gabarits filtre sur `role` et `famille`.

**Le gabarit ne contient que de la géométrie.** Coins arrondis, bordures, polices et palette relèvent du thème.

Le JSON n'est pas validé par la base : il est typé et **validé à la lecture** avec Zod. Un gabarit mal formé doit échouer bruyamment au chargement, pas produire un PDF silencieusement faux.

### Theme

Donnée de référence. Trois ou quatre au départ, pas de nuancier libre.

`id`, `nom`, `policeTitre`, `policeTexte`, `palette` (JSON : fond, texte, accent), `rayonAngles` (mm), `bordureCadre` (JSON : épaisseur, couleur ; vide = sans bordure), `margeInterieure` (mm), `actif`.

Un thème utilisé par un projet ou un modèle ne peut pas être supprimé (`RESTRICT`) : on le désactive.

Un catalogue restreint est l'application de « retrancher plutôt qu'ajouter » au style : trois thèmes cohérents produisent de meilleurs livres qu'un sélecteur de police à deux cents entrées.

### ModeleLivre

Donnée de référence, créée par le script d'initialisation. Lecture pour tous, y compris les visiteurs — le catalogue est visible avant toute inscription.

`id`, `nom`, `themeId`, `gabaritCouvertureId`, `gabaritQuatriemeId`, `famille`, `nombreDoublesPagesDepart`, `cleApercu`, `actif`.

À la création d'un projet, l'API **copie** le modèle : le thème dans `projet.themeId`, la couverture et la 4e avec leurs gabarits, puis `nombreDoublesPagesDepart` doubles pages intérieures dont les gabarits sont pris dans la `famille` du modèle. Le projet ne garde qu'un `modeleOrigineId` informatif — modifier un modèle n'affecte aucun livre existant, et un livre créé depuis un modèle est modifiable sans restriction.

Les clés étrangères vers `Theme` et `Gabarit` (`RESTRICT`) garantissent qu'un modèle ne peut pas référencer un gabarit inexistant. Le rôle des gabarits de couverture et de 4e est vérifié par le service.

`gabaritQuatriemeId` découle de la 4e en double page distincte : **à valider**.

### DoublePage

`id`, `projetId`, `role` (`couverture` | `interieur` | `quatrieme`), `position`, `gabaritOrigineId` (informatif), `creeLe`.

**L'unité est la double page, pas la page** : une photo panoramique traverse le pli et forme un seul cadre ; un modèle page par page ne peut pas l'exprimer. Le prix est une gymnastique de conversion à l'affichage — la double page 3 correspond aux pages 6 et 7.

**La couverture et la 4e sont deux doubles pages**, repérées par leur `role` et créées avec le projet. Elles s'éditent comme les autres, avec des gabarits de même rôle : une table et un cas particulier de moins dans l'éditeur et le rendu. Une seule de chaque par projet (unicité partielle). Pas de tranche, pas de type souple ou rigide dans le MVP.

**`position`** est vide pour la couverture et la 4e, et va de 1 à N, sans trou, pour les doubles pages intérieures.

**Pas de contrainte d'unicité sur `position`** : une renumérotation passe brièvement par des états où deux pages partagent un rang. Toutes les opérations d'ordre — insertion, suppression, déplacement, duplication — passent par **une seule fonction TypeScript, dans une transaction**, qui ne renumérote que les doubles pages intérieures et garantit l'absence de doublon et de trou.

Le gabarit d'une double page a le même rôle qu'elle : vérifié par le service. `gabaritOrigineId` passe à `NULL` si le gabarit est supprimé.

### Emplacement

`id`, `projetId`, `doublePageId`, `indice` (unique par double page), `nature` (`photo` | `texte`), `x`, `y`, `largeur`, `hauteur`, `photoId`, `cadrage {x, y, zoom}`, `contenuTexte`.

`nature` et la géométrie sont **copiées du gabarit**, jamais choisies librement.

Un emplacement **peut être vide** : c'est normal, pas une anomalie. Supprimer une photo vide les emplacements qui la portaient (`SET NULL`). La photo appartient au même projet que son emplacement : vérifié par le service. Deux emplacements peuvent référencer la **même photo** — c'est ce qui permet de dupliquer une page sans copier aucun fichier.

Les champs non pertinents selon la nature restent vides : prix assumé d'une table unique pour deux natures, la cohérence étant garantie par un `CHECK`. Une hiérarchie de tables pour deux cas serait disproportionnée.

### Export

Relation **au plus un** par projet : une nouvelle demande remplace la précédente.

`id`, `projetId` (unique), `statut` (`demande` | `en_cours` | `reussi` | `echec`), `demandeLe`, `termineLe`, `cleStockage`, `messageErreur`.

Une entité et non un statut sur le projet, parce que **l'état existe avant son résultat** : au moment où le rendu est demandé le fichier n'existe pas encore, et un échec doit se poser quelque part.

La ligne sert aussi de **file au worker**, lue avec `SKIP LOCKED` : pas de table de tâches. → [`architecture.md`](architecture.md#la-file-dattente)

L'ancien fichier n'est supprimé **qu'une fois le nouveau réussi** : sinon un rendu qui échoue laisse l'utilisateur sans rien. Pas d'expiration : le dernier PDF reste disponible.

`messageErreur` est un texte libre : un échec d'export n'a pas de taxonomie stable, il n'y en a qu'un par projet, et il s'adresse d'abord au développeur.

---

## Dénormalisation de `projetId`

`projetId` est présent sur `DoublePage`, `Emplacement` et `Export`, alors que la chaîne de références permettrait de le retrouver.

Raison : chaque vérification d'autorisation devient une **comparaison sur une colonne indexée** au lieu d'une jointure remontante sur trois niveaux. Une règle d'accès à trois niveaux est difficile à relire, donc à auditer — c'est exactement là que naissent les failles.

Le champ est **écrit par l'API, jamais par le client**. C'est ce qui empêche la donnée dupliquée de mentir : personne ne peut poser un emplacement dans une double page A en le déclarant appartenant au projet B.

---

## Contraintes hors schéma Prisma

Prisma n'exprime ni `CHECK` ni unicité partielle : ces règles sont écrites en SQL brut dans une migration.

| Règle | Mécanisme |
|---|---|
| `position` vide si et seulement si la double page n'est pas intérieure | `CHECK ((position IS NULL) = (role <> 'interieur'))` |
| Une seule couverture et une seule 4e par projet | Unicité partielle `(projetId, role) WHERE role <> 'interieur'` |
| Cohérence d'un emplacement selon sa nature | `CHECK` sur `nature`, `photoId`, `cadrage`, `contenuTexte` |

Les énumérés (`role`, `nature`, `statut`, `sourceType`) sont des types PostgreSQL. Les clés étrangères sont en `ON DELETE CASCADE`, sauf mention contraire dans ce document.

---

## Ce qui n'est volontairement pas modélisé

- **Bibliothèque de photos partagée entre projets.** Hors périmètre.
- **Curation** : scores, empreinte perceptuelle, suggestions. Retirée du périmètre.
- **Historique des versions d'un livre.** Hors périmètre.
- **Partage, collaboration, commentaires.** Hors périmètre.
- **Champs de style au niveau du projet** qui l'emporteraient sur le thème : le thème est un préréglage, aucun ajustement par livre dans le MVP. Évolution possible, coût futur d'un ajout de colonnes.

---

## Priorité documentaire

Les **spécifications fonctionnelles priment sur ce document** pour la définition des écrans et de leurs états.