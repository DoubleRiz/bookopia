# Modèle de données

Le schéma Prisma (`packages/db/prisma/schema.prisma`) fait foi pour les types exacts. Ce document porte les **invariants et les justifications** qu'un schéma ne peut pas exprimer.

## Vue d'ensemble

```
Utilisateur
 └── Projet                  (0..n)
      ├── Couverture         (1, créée vide avec le projet)
      ├── Photo              (0..n)
      ├── Export             (0..1)
      └── DoublePage         (0..n, ordonnées)
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

La couverture, elle, **référence** son gabarit : elle n'est pas éditable librement et ses gabarits sont peu nombreux, la copie n'apporterait rien. Asymétrie assumée.

---

## Entités

### Utilisateur

`id`, `email` (unique), `motDePasseHache`, `nomAffichage`, `creeLe`, `modifieLe`.

Un seul champ de nom : aucun usage ne sépare prénom et nom. Supprimer un compte supprime en cascade ses projets, leurs photos et les fichiers correspondants.

> Le mécanisme d'authentification (hachage, session ou jeton) est une question ouverte de l'architecture.

### Projet

`id`, `utilisateurId`, `titre`, `etat` (`brouillon` | `termine`), `themeId`, `creeLe`, `modifieLe`.

- **Pas de champ format** : le format est unique et l'information vit déjà dans les dimensions des gabarits. Un champ à valeur unique ment sur le modèle.
- **Pas de compteur** de pages ni de photos : ça se calcule, et un compteur stocké se désynchronise.
- **`etat` ne bascule que sur un geste explicite** : `termine` sur « Marquer terminé » (carte E4), retour à `brouillon` sur « Rouvrir ». Ni l'export ni la composition n'y touchent.
- **Pas d'état de rendu** : « en cours de rendu » décrit un traitement, pas une intention. Sa place est dans `Export`.

### Couverture

Relation **un pour un** avec le projet, créée vide en même temps que lui par l'API.

`id`, `projetId` (unique), `type` (`souple` | `rigide`), `gabaritId`, `titre`, `sousTitre`, `photoId`, `cadrage {x, y, zoom}`.

Entité distincte et non « double page avec un drapeau » : la 1re de couverture, la tranche et la 4e forment une seule surface imprimée en un passage, et la couverture ne partage **aucune règle** avec une double page — ni création, ni suppression, ni déplacement, ni duplication. La ressemblance visuelle ne fait pas la parenté.

La **largeur de tranche n'est pas stockée** : elle se calcule depuis le nombre de doubles pages et le type de couverture.

### Photo

Rattachée au **projet**, pas à l'utilisateur : deux livres partageant une photo la stockent deux fois.

**Intrinsèque au fichier** : `cleStockage`, `nomFichierOrigine`, `empreinteFichier` (SHA-256, **unique par projet**, bloque les doublons stricts), `largeurPx`, `hauteurPx`, `priseLe`, `exifJson`, `empreintePerceptuelle` (dHash), `scoreNettete`, `scoreExposition`.

**Propre à l'usage dans ce livre** : `sourceType`, `etatTraitement` (`en_attente` | `prete` | `echec`), `motifEchec`, `nombreTentatives`, `prochaineTentativeLe`, `suggestionExclusion`, `motifSuggestion`, `groupeSimilarite`, `creeLe`.

`nomFichierOrigine` existe pour une raison précise : sans lui, un utilisateur dont trois photos ont échoué sur trois cents ne sait pas lesquelles réimporter. `cleStockage` est un identifiant opaque et doit le rester.

`groupeSimilarite` (nullable) est écrit par le job de similarité : les photos d'un même groupe sont des quasi-doublons. Dans chaque groupe, celle qui a le meilleur `scoreNettete` est gardée, les autres sont suggérées comme similaires. Le champ est entièrement recalculé à chaque passage du job. → [`architecture.md`](architecture.md#la-similarité)

`motifEchec` est un **type énuméré, jamais un message libre** : un message technique ne veut rien dire pour un utilisateur et ne peut être ni traduit ni fait évoluer. Le code stocke le motif, l'interface décide du texte.

| Motif | Sens |
|---|---|
| `format_non_supporte` | HEIC, RAW… |
| `fichier_corrompu` | Le fichier n'a pas pu être lu |
| `erreur_technique` | Erreur interne |

La **résolution insuffisante n'est jamais un échec**, seulement un avertissement. Les fichiers trop lourds et les formats refusés sont arrêtés **à la sélection**, avant tout envoi.

**Il n'y a pas de champ de décision utilisateur.** La curation a une seule action : écarter, ce qui **supprime définitivement** la ligne et le fichier. Pas de « rétablir ». Décision motivée par le stockage.

### Gabarit

Donnée de référence, créée par un script d'initialisation. Lecture pour tous, écriture pour personne.

`id`, `nom`, `portee` (`page` | `couverture`), `nombreCadres` (dénormalisé pour le filtrage), `definition` (JSON), `actif`.

Un cadre : `{ indice, x, y, largeur, hauteur, nature: "photo" | "texte", traverseLePli }`, en **millimètres**.

**Le gabarit ne contient que de la géométrie.** Coins arrondis, bordures, polices et palette relèvent du thème.

Le JSON n'est pas validé par la base : il est typé et **validé à la lecture** avec Zod. Un gabarit mal formé doit échouer bruyamment au chargement, pas produire un PDF silencieusement faux.

### Theme

Donnée de référence. Trois ou quatre au départ, pas de nuancier libre.

`id`, `nom`, `policeTitre`, `policeTexte`, `palette` (JSON), `rayonAngles`, `bordureCadre`, `margeInterieure`, `actif`.

Un catalogue restreint est l'application de « retrancher plutôt qu'ajouter » au style : trois thèmes cohérents produisent de meilleurs livres qu'un sélecteur de police à deux cents entrées.

### ModeleLivre

Donnée de référence, créée par le script d'initialisation. Lecture pour tous, y compris les visiteurs — le catalogue est visible avant toute inscription.

`id`, `nom`, `categorie`, `description`, `themeId`, `typeCouverture`, `gabaritCouvertureId`, `composition` (JSON), `ordre`, `actif`.

`composition` est la liste ordonnée des gabarits des doubles pages : `[{ position, gabaritId }, …]`. Le nombre de doubles pages s'en déduit, il n'est pas stocké.

À la création d'un projet, l'API **copie** le modèle : thème, couverture et doubles pages avec leurs emplacements. Le projet ne garde **aucune référence** vers le modèle — modifier un modèle n'affecte aucun livre existant, et un livre créé depuis un modèle est modifiable sans restriction.

Les clés étrangères vers `Theme` et `Gabarit` garantissent qu'un modèle ne peut pas référencer un gabarit inexistant. La portée du gabarit de couverture est vérifiée par une contrainte.

### DoublePage

`id`, `projetId`, `position` (entier contigu à partir de 1), `gabaritOrigineId` (informatif), `creeLe`.

**L'unité est la double page, pas la page** : une photo panoramique traverse le pli et forme un seul cadre ; un modèle page par page ne peut pas l'exprimer. Le prix est une gymnastique de conversion à l'affichage — la double page 3 correspond aux pages 6 et 7.

**Pas de contrainte d'unicité sur `position`** : une renumérotation passe brièvement par des états où deux pages partagent un rang. Toutes les opérations d'ordre — insertion, suppression, déplacement, duplication — passent par **une seule fonction TypeScript, dans une transaction**, qui garantit l'absence de doublon et de trou.

### Emplacement

`id`, `projetId`, `doublePageId`, `indice`, `nature` (`photo` | `texte`), `x`, `y`, `largeur`, `hauteur`, `traverseLePli`, `photoId`, `cadrage`, `contenuTexte`.

`nature` et la géométrie sont **copiées du gabarit**, jamais choisies librement.

Un emplacement **peut être vide** : c'est normal, pas une anomalie. Deux emplacements peuvent référencer la **même photo** — c'est ce qui permet de dupliquer une page sans copier aucun fichier.

Les champs non pertinents selon la nature restent vides : prix assumé d'une table unique pour deux natures, la cohérence étant garantie par le code. Une hiérarchie de tables pour deux cas serait disproportionnée.

### Export

Relation **au plus un** par projet : une nouvelle demande remplace la précédente.

`id`, `projetId` (unique), `statut` (`demande` | `en_cours` | `reussi` | `echec`), `demandeLe`, `termineLe`, `cleStockage`, `messageErreur`, `expireLe`.

Une entité et non un statut sur le projet, parce que **l'état existe avant son résultat** : au moment où le rendu est demandé le fichier n'existe pas encore, et un échec doit se poser quelque part.

L'ancien fichier n'est supprimé **qu'une fois le nouveau réussi** : sinon un rendu qui échoue laisse l'utilisateur sans rien.

`messageErreur` reste un texte libre, contrairement à `motifEchec` : un échec d'export n'a pas de taxonomie stable, il n'y en a qu'un par projet, et il s'adresse d'abord au développeur.

---

## Dénormalisation de `projetId`

`projetId` est présent sur `DoublePage`, `Emplacement` et `Export`, alors que la chaîne de références permettrait de le retrouver.

Raison : chaque vérification d'autorisation devient une **comparaison sur une colonne indexée** au lieu d'une jointure remontante sur trois niveaux. Une règle d'accès à trois niveaux est difficile à relire, donc à auditer — c'est exactement là que naissent les failles.

Le champ est **écrit par l'API, jamais par le client**. C'est ce qui empêche la donnée dupliquée de mentir : personne ne peut poser un emplacement dans une double page A en le déclarant appartenant au projet B.

---

## Ce qui n'est volontairement pas modélisé

- **Bibliothèque de photos partagée entre projets.** La frontière est identifiée (les deux blocs de champs de `Photo`) mais non matérialisée. Si le besoin apparaît, on coupe la table le long de cette ligne : une migration, pas une refonte.
- **Historique des versions d'un livre.** Hors périmètre.
- **Partage, collaboration, commentaires.** Hors périmètre.
- **Champs de style au niveau du projet** qui l'emporteraient sur le thème : évolution possible, coût futur d'un ajout de colonnes.

---

## Priorité documentaire

Les **spécifications fonctionnelles priment sur ce document** pour la définition des écrans et de leurs états.