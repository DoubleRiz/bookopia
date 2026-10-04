# Architecture

## Vue d'ensemble

```
Navigateur                     React + Vite
   │  HTTP (REST, JSON)
   ▼
API                            Fastify + Prisma
   │  écrit en base, dépose une tâche
   ▼
PostgreSQL                     données + file d'attente
   │  SELECT … FOR UPDATE SKIP LOCKED
   ▼
Worker                         Node + sharp + pdf-lib
   │  écrit le résultat en base, les fichiers sur disque
   └─► LISTEN/NOTIFY ─► SSE ─► Navigateur (avancement)
```

Tout tourne dans Docker Compose : `web`, `api`, `worker`, `db`, plus un volume pour les fichiers. Le même fichier Compose sert en local et sur le serveur.

| Composant | Rôle |
|---|---|
| `apps/web` | Interface, moteur de gabarits, écran de curation |
| `apps/api` | Authentification, autorisation, règles métier, dépôt des tâches, flux SSE |
| `apps/worker` | Ingestion des photos, rendu PDF, purges |
| PostgreSQL | Données, contraintes, file d'attente |
| Disque | Originaux, vignettes, PDF — monté en volume |

L'application ne dépend d'aucun service tiers.

---

## L'API

Le navigateur n'a aucun accès direct à la base. Tout passe par l'API, qui porte :

- **L'authentification** et l'autorisation. Chaque requête vérifie que la ressource visée appartient à un projet dont l'appelant est propriétaire — une comparaison sur `projetId`, colonne indexée présente sur toutes les tables de l'arbre projet.
- **Les règles métier** : création de la couverture avec le projet, copie de la géométrie du gabarit dans les emplacements, renumérotation des doubles pages, propagation de `projetId`.
- **La validation** de toute entrée, avec Zod.
- **Le dépôt des tâches** destinées au worker.
- **Le flux SSE** qui pousse l'avancement vers le navigateur.

Les contraintes d'unicité, d'intégrité référentielle et les vérifications simples vivent dans PostgreSQL. Il n'y a pas de triggers : la logique procédurale est en TypeScript.

---

## Le worker

Un processus séparé, parce que traiter trois cents photos prend plusieurs minutes alors que l'API doit répondre en quelques millisecondes. L'API dépose une tâche et répond immédiatement ; le worker dépile et travaille ; l'écran ne se fige jamais.

Le worker ne reçoit jamais rien du navigateur. La seule chose qui les relie est la file.

Il traite quatre familles de travaux :

| Travail | Grain | Contenu |
|---|---|---|
| Ingestion | Un job par photo | Vignettes, extraction EXIF, dHash, variance du laplacien, analyse d'histogramme |
| Similarité | Un job par projet | Regroupement des quasi-doublons, une fois l'ingestion terminée |
| Rendu PDF | Un job par projet | Composition avec `pdf-lib` |
| Google Photos | Un job par média | Copie des fichiers — lot ultérieur |

Il assure aussi les purges périodiques : exports expirés (environ sept jours) et fichiers orphelins.

Les algorithmes d'analyse d'image sont écrits à la main — une quarantaine de lignes chacun — et non importés.

---

## La file d'attente

Une table PostgreSQL. Le worker dépile avec `SELECT … FOR UPDATE SKIP LOCKED` : plusieurs instances peuvent tourner côte à côte sans se marcher dessus, et l'état d'un travail s'inspecte en SQL ordinaire.

**Reprises** : trois tentatives espacées de 2 s, 10 s puis 30 s. Au-delà, la photo bascule en échec avec un motif. Le compteur et la date de prochaine tentative sont portés par la ligne `Photo`.

**Enchaînement ingestion → similarité** : à la fin de chaque job d'ingestion, dans la même transaction, le worker vérifie s'il reste des photos `en_attente` dans le projet. S'il n'en reste aucune, il dépose le job de similarité. Une contrainte d'unicité sur `(projetId, type)` pour les jobs non démarrés empêche d'en déposer deux.

---

## La similarité

Repérer les quasi-doublons demande de comparer chaque photo à toutes les autres : ce n'est pas un travail par photo, mais par projet.

1. **Comparaison de toutes les paires** par distance de Hamming entre dHash. Pour 300 photos : environ 45 000 comparaisons d'entiers de 64 bits, quelques millisecondes.
2. **Deux photos sont liées** si la distance est inférieure au seuil — environ 10 bits sur 64, à calibrer sur un jeu de photos réel — **et** si leurs `priseLe` sont proches de quelques minutes. La fenêtre de temps limite les faux positifs et l'effet de chaîne (A ressemble à B, B à C, A pas à C).
3. **Les groupes** sont formés par union-find, écrit à la main.
4. **Dans chaque groupe**, la photo au meilleur `scoreNettete` est gardée ; les autres reçoivent une suggestion « similaire ».

Le job réécrit `groupeSimilarite` pour tout le projet : il est recalculable à volonté et se rejoue après chaque nouvel import. C'est une fonction pure sur une liste de photos, testable unitairement.

**Alternative écartée** : comparer dans le job d'ingestion de chaque photo, avec les photos déjà prêtes. Deux photos traitées en parallèle par deux workers ne se voient pas, et le résultat dépend de l'ordre d'arrivée — il faudrait un verrou par projet pour le rendre juste.

---

## L'avancement

Le worker écrit son résultat en base et émet un `NOTIFY`. L'API écoute et pousse l'événement au navigateur sur une connexion SSE ouverte pendant l'import ou le rendu. Le repli, si la connexion ne tient pas, est un polling sur l'état du projet.

---

## Le rendu PDF

`pdf-lib` construit le PDF page par page, en millimètres, et écrit les boîtes attendues par un imprimeur : MediaBox, TrimBox, BleedBox, fonds perdus et traits de coupe.

Il existe donc deux moteurs de rendu — l'aperçu HTML dans le navigateur et le PDF — qui doivent produire le même résultat. **Le recadrage est le point à valider en premier** : c'est là qu'ils risquent le plus de diverger.

---

## Les fichiers

Originaux, vignettes et PDF sont écrits sur le disque du serveur, dans un volume Docker.

Ils ne sont jamais servis par l'API : celle-ci vérifie l'autorisation puis délivre une **URL signée à durée courte**. La sauvegarde doit couvrir le volume et la base de façon cohérente.

---

## Hébergement

VPS KVM (Hostinger, France). Déploiement par Docker Compose, à l'identique du poste de développement.

---

## À valider tôt

1. Le recadrage rend le même résultat dans l'aperçu HTML et dans le PDF.
2. Les contraintes d'impression sont correctement écrites par `pdf-lib`.
3. La chaîne dépôt de tâche → worker → `NOTIFY` → SSE fonctionne de bout en bout sur une photo.

## Questions ouvertes

- Mécanisme d'authentification (session serveur ou jeton) et durée de vie.
- Profil colorimétrique du PDF : sRGB ou CMJN, et moment de la conversion.
- Stratégie de sauvegarde du volume de fichiers.
- Google Photos : intégration par la Picker API uniquement.
