# Architecture

## Vue d'ensemble

```
Navigateur                     React + Vite
   │  HTTP (REST, JSON)
   ▼
API                            Fastify + Prisma + sharp
   │  traite les photos à l'import, passe l'export en « demande »
   ▼
PostgreSQL                     données + file (table export)
   │  SELECT … FOR UPDATE SKIP LOCKED
   ▼
Worker                         Node + pdf-lib
   │  écrit le statut en base, le PDF sur disque
   └─► LISTEN/NOTIFY ─► SSE ─► Navigateur (avancement du rendu)
```

Tout tourne dans Docker Compose : `web`, `api`, `worker`, `db`, plus un volume pour les fichiers. Le conteneur `web` est Caddy : il sert le front compilé, relaie `/api/*` vers Fastify et gère le HTTPS, certificat Let's Encrypt compris. Le même fichier Compose sert en local et sur le serveur.

| Composant | Rôle |
|---|---|
| `apps/web` | Interface, moteur de gabarits, reprise d'un envoi interrompu |
| `apps/api` | Authentification, autorisation, règles métier, traitement des photos à l'import, flux SSE |
| `apps/worker` | Rendu PDF, purge des fichiers orphelins |
| PostgreSQL | Données, contraintes, file d'attente |
| Disque | Originaux, vignettes, PDF — monté en volume |

---

## L'API

Le navigateur n'a aucun accès direct à la base. Tout passe par l'API, qui porte :

- **L'authentification** : session opaque en base, transportée par un cookie `httpOnly`, mot de passe haché en argon2id. → [L'authentification](#lauthentification)
- **L'autorisation**. L'identifiant utilisateur vient de la session vérifiée, jamais d'un paramètre. Aucun service n'appelle `prisma` directement : tout passe par un dépôt construit à partir de l'utilisateur authentifié, et une règle ESLint interdit l'import de `prisma` ailleurs. La vérification est une comparaison sur `projetId`, colonne indexée présente sur toutes les tables de l'arbre projet.
- **Les règles métier** : création de la couverture et de la 4e avec le projet, copie de la géométrie du gabarit dans les emplacements, renumérotation des doubles pages intérieures, propagation de `projetId`.
- **Le traitement des photos à l'import**, de façon synchrone.
- **La validation** de toute entrée, avec Zod.
- **Le flux SSE** qui pousse l'avancement du rendu vers le navigateur.

Des tests d'accès vérifient l'autorisation : deux utilisateurs, chacun ne voit que ses projets.

Les contraintes d'unicité, d'intégrité référentielle et les vérifications simples vivent dans PostgreSQL. Il n'y a pas de triggers : la logique procédurale est en TypeScript. → [`modele-donnees.md`](modele-donnees.md#contraintes-hors-schéma-prisma)

### L'authentification

Écrite à la main, sans bibliothèque d'authentification : quatre routes et un contrôle de session.

- **Mot de passe** haché en argon2id avec l'argon2 natif de Node (≥ 24.7), aux paramètres minimaux de l'OWASP (19 Mio, 2 passes). Les paramètres sont stockés avec l'empreinte, au format PHC : les durcir plus tard n'invalide aucun compte. Longueur de 8 à 128 caractères ; le plafond évite qu'une entrée énorme coûte cher à hacher.
- **Session** : un jeton aléatoire de 32 octets dans un cookie `httpOnly`, `Secure`, `SameSite=Lax`. La table `session` n'en garde que l'empreinte SHA-256 : une fuite de la base ne permet pas d'usurper une session. Durée fixe de 30 jours, sans prolongation à l'usage.
- **Déconnexion** : la ligne est supprimée, le jeton ne vaut plus rien, même copié ailleurs.
- **Connexion** : même réponse pour un email inconnu et un mot de passe faux, et un hachage factice est vérifié quand l'email n'existe pas, pour que le temps de réponse ne trahisse pas les comptes existants. Un jeton neuf est émis à chaque connexion.

**Pourquoi une session en base plutôt qu'un JWT** : l'intérêt d'un JWT est d'authentifier sans lire la base. Or l'API la lit à chaque requête de toute façon, pour l'autorisation. Le JWT n'apporterait que ses défauts : impossible à révoquer avant expiration, une clé de signature à protéger et faire tourner, des pièges d'algorithme. La session en base est plus simple et révocable.

**Coût** : une lecture indexée sur `session.jetonHache` par requête authentifiée, et une table de plus. L'API ne peut pas se répartir sur plusieurs bases sans partager cette table — hors de propos pour un seul VPS.

**Alternatives écartées** :

- **JWT seul** : la déconnexion n'efface que le cookie, un jeton volé reste valide jusqu'à expiration, et changer de mot de passe ne coupe pas les sessions ouvertes.
- **JWT + colonne de version sur `utilisateur`** : révocation possible, mais seulement de toutes les sessions d'un coup, en gardant la complexité du JWT et la lecture en base.
- **JWT court + jetons de rafraîchissement en table** : révocable par appareil, mais deux jetons, une route de rafraîchissement et une logique de relance côté front. Conçu pour des API sans état partagées entre services, pas pour une API unique.

**Reste à faire** : limiter le nombre de tentatives de connexion.

### Le verrou de projet

Les opérations d'ordre — insérer, déplacer, supprimer, dupliquer une double page — lisent le nombre et l'ordre des intérieures, puis réécrivent les rangs. Deux insertions simultanées liraient le même état et produiraient deux doubles pages au même rang.

Chaque opération commence donc par `SELECT … FOR UPDATE` sur la ligne `projet`, dans sa transaction : les écritures d'ordre d'un même projet passent l'une après l'autre. La même requête filtre sur `utilisateurId` et sert de vérification d'autorisation.

**Coût** : deux onglets ouverts sur le même livre attendent chacun leur tour, le temps d'une transaction de quelques millisecondes. Les projets distincts ne se gênent pas.

**Alternatives écartées** :

- **Unicité sur `(projetId, position)`** : une renumérotation traverse des états où deux rangs coïncident. Il faudrait une contrainte différée (`DEFERRABLE`), que Prisma n'exprime pas, et elle ne ferait que rejeter la seconde opération au lieu de la servir.
- **Isolation `SERIALIZABLE`** : même garantie, mais l'opération perdante échoue et doit être rejouée par l'API. Le verrou fait attendre au lieu d'échouer.

### Routes

| Opération | Route |
|---|---|
| S'inscrire, se connecter, se déconnecter | `POST /api/auth/inscription`, `POST /api/auth/connexion`, `POST /api/auth/deconnexion` |
| Lire l'utilisateur de la session | `GET /api/auth/moi` |
| Créer un projet, le renommer | `POST /api/projets`, `PATCH /api/projets/:id` |
| Créer, déplacer, supprimer une double page | `/api/projets/:id/doubles-pages` |
| Changer le gabarit d'une double page | `PATCH /api/doubles-pages/:id` |
| Poser une photo, la recadrer | `PATCH /api/emplacements/:id` |
| Supprimer une photo | `DELETE /api/photos/:id` |
| Modifier la couverture ou la 4e | Mêmes routes que les doubles pages (rôle `couverture` / `quatrieme`) |
| Importer des fichiers (traitement synchrone) | `POST /api/projets/:id/imports` |
| Démarrer un export PDF | `POST /api/projets/:id/exports` |
| Suivre l'avancement du rendu | `GET /api/projets/:id/avancement` (SSE) |
| Orchestrer le parcours Google Photos | `/api/projets/:id/google-photos/*` |

---

## L'import

Sans curation, il ne reste qu'une vignette et une date à extraire : un travail court, fait dans la requête. Le passer par le worker coûterait une table de tâches, des reprises et un état « en traitement » pour rien.

1. Le front envoie les fichiers par lots à `POST /api/projets/:id/imports` et affiche l'avancement de l'envoi (n sur N).
2. Pour chaque fichier : empreinte SHA-256 calculée, `sharp` produit la vignette et lit dimensions et date de prise de vue, l'original est redimensionné à ce que 300 DPI exigent pour le plus grand cadre du catalogue, les fichiers sont écrits sur le volume, la ligne `Photo` est créée.
3. Un doublon strict est rejeté par l'unicité `(projetId, empreinteFichier)`.
4. L'API répond avec les photos créées et la liste des fichiers refusés.

Une photo n'existe en base qu'une fois traitée : il n'y a pas d'état « en traitement ».

**Échecs** : un fichier trop lourd ou d'un format non pris en charge est refusé à la sélection par le front, et l'API revérifie. Un fichier corrompu n'est détecté qu'à l'ouverture par `sharp` : aucune ligne n'est créée, son nom est renvoyé au front. Pas de reprise : le fichier est resté sur le disque du Créateur, un réessai serveur n'aurait rien à traiter.

---

## Le worker

Un processus séparé, parce qu'un rendu PDF prend trop longtemps pour tenir dans une requête. L'API enregistre la demande et répond immédiatement ; le worker dépile et rend ; l'écran ne se fige jamais.

Le worker ne reçoit jamais rien du navigateur. La seule chose qui les relie est la file.

| Travail | Grain | Contenu |
|---|---|---|
| Rendu PDF | Un job par export | Composition avec `pdf-lib` |
| Purge | Planifié | Fichiers orphelins |

---

## La file d'attente

La table `export` est sa propre file : un seul export par projet, son statut dit où il en est. Pas de seconde table à garder synchrone.

```sql
SELECT * FROM export
WHERE statut = 'demande'
ORDER BY demande_le
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

1. `POST /api/projets/:id/exports` passe la ligne `export` en `demande`.
2. Le worker la prend, la passe `en_cours`, rend le PDF sous une nouvelle clé, puis `reussi`, et remplace l'ancien fichier.
3. En cas d'échec : statut `echec` avec un `messageErreur` libre. Le PDF précédent reste téléchargeable, le Créateur relance quand il veut.

---

## L'avancement

Chaque changement de statut de l'export émet un `NOTIFY`. L'API écoute et pousse l'événement au navigateur sur une connexion SSE ouverte pendant le rendu. Le repli, si la connexion ne tient pas, est un polling sur l'état de l'export.

---

## Le rendu PDF

Une seule source de vérité géométrique, deux consommateurs :

```
Gabarit (JSON, mm)  ──┬──►  rendu React    ──►  écran
                      └──►  rendu pdf-lib  ──►  PDF
```

Les deux moteurs doivent produire le même résultat. **Le recadrage est le point à valider en premier** : c'est là qu'ils risquent le plus de diverger.

Le rendu PDF est une fonction pure — `rendre(projet) → Buffer` — qui vit dans `packages/shared` et se teste sans navigateur, sans base et sans conteneur.

| Contrainte d'impression | Traitement |
|---|---|
| Boîtes PDF | MediaBox, TrimBox et BleedBox posées explicitement |
| Fond perdu | 3 mm sur les photos pleine page, plus traits de coupe |
| 300 DPI effectifs | `largeurPx / largeurMm × 25,4 ≥ 300` par emplacement photo, avertissement sinon |
| Colorimétrie | RVB, pas de conversion CMJN : l'imprimeur convertit |
| Typographie | Mêmes fichiers de police des deux côtés, mesure via `fontkit`, limite de caractères plutôt que retour à la ligne automatique |

Ces contraintes sont intégrées dès le premier lot.

---

## Les fichiers

Originaux, vignettes et PDF sont écrits sur le disque du serveur, dans le volume Docker `fichiers`, monté dans l'API et le worker. Caddy ne le monte pas : aucun fichier n'est servi directement par le reverse proxy.

### Arborescence

```
projets/
  {projetId}/
    originaux/{cle}.jpg
    vignettes/{cle}.webp
    exports/{cle}.pdf
```

`cleStockage` est un UUID nu, opaque ; le chemin se déduit de `(projetId, cle)` par les fonctions de `@bookopia/stockage`, qui refusent tout identifiant non UUID. L'original et la vignette d'une photo partagent la même clé. Regrouper par projet rend la suppression d'un projet ou d'un compte triviale.

- **Original en JPEG** : pdf-lib n'intègre que JPEG et PNG, et l'original est ré-encodé de toute façon au redimensionnement. Coût : une perte de génération, invisible à qualité 90.
- **Vignette en WebP** : lue seulement par le navigateur, environ 30 % plus légère qu'un JPEG sur une grille de 300. Coût : un second format, produit par `sharp` sans dépendance.

### Accès

L'accès passe par une interface unique, implémentée sur disque aujourd'hui, remplaçable par un stockage objet sans toucher au reste :

```ts
interface StockageFichiers {
  ranger(chemin: string, contenu: Buffer): Promise<void>;
  lire(chemin: string): Promise<Buffer>;
  flux(chemin: string): Promise<Readable>;
  supprimer(chemin: string): Promise<void>;
  urlSignee(chemin: string, dureeSecondes: number): Promise<string>;
}
```

`flux` permet de diffuser un PDF de plusieurs dizaines de Mo sans le charger en mémoire. `ranger` écrit dans un fichier temporaire puis renomme : un fichier à moitié écrit n'est jamais lisible. Tout chemin est vérifié sous la racine.

Le code vit dans `packages/stockage`, et non dans `packages/shared` : il lit le disque, le front ne doit pas pouvoir l'importer.

### Distribution par URL signée

L'API vérifie l'autorisation puis délivre une **URL signée à durée courte** : `/api/fichiers/{chemin}?expire=…&signature=…`, signature HMAC-SHA256 du chemin et de l'expiration avec `SECRET_URL_SIGNEE`.

Sur disque, aucun fournisseur ne sert cette URL : c'est l'API qui la vérifie et diffuse le fichier, par `GET /fichiers/*`, **sans requête en base** — la signature prouve l'autorisation donnée à l'émission. Signature invalide ou expirée : 403 ; fichier absent : 404. Le navigateur garde le fichier en cache jusqu'à l'expiration. Avec un stockage objet, ce rôle passerait au fournisseur et la route disparaîtrait.

| Option | Coût | Décision |
|---|---|---|
| **L'API vérifie la signature et diffuse** | Un secret à gérer ; l'API diffuse des octets | Retenue |
| Caddy diffuse, l'API autorise par `forward_auth` | Volume monté dans Caddy, configuration difficile à tester | Écartée |
| Route protégée par le cookie de session | Abandonne l'URL signée ; une requête en base par vignette | Écartée |

Jeu de test courant à 30 photos, 300 pour la démonstration.

---

## Hébergement

VPS KVM chez Hostinger (France), 2 vCPU / 8 Go / 100 Go, souscrit pour la période d'examen. Après la soutenance, l'application continue de tourner en local. Déploiement par Docker Compose et le profil `app`, à l'identique du poste de développement : seules `ADRESSE_SITE`, `PORT_HTTP` et `PORT_HTTPS` changent dans le `.env`.

| Point | Traitement |
|---|---|
| TLS | Caddy, certificat Let's Encrypt automatique |
| Base | Port lié à `127.0.0.1` : Docker contourne `ufw`, le pare-feu seul ne suffirait pas |
| Pare-feu | `ufw` : 80, 443 et SSH uniquement |
| SSH | Authentification par clé, mot de passe désactivé |
| Mises à jour | `unattended-upgrades` |
| Secrets | Fichier `.env` hors dépôt |
| Sauvegardes | `pg_dump` quotidien et archive du volume `fichiers`, hors du VPS |
| Déploiement | Par Compose uniquement, jamais depuis le panneau d'administration |

---

## Intégrations

### Google Photos — Picker API

Chemin secondaire, prévu pour un lot ultérieur : l'envoi de fichiers reste le parcours par défaut.

- Création de session, suivi, rapatriement et traitement des fichiers dans l'API, comme un import de fichiers.
- Les `baseUrl` expirent en une heure environ : les fichiers sont copiés immédiatement sur le volume.
- Scope sensible : rester en mode *Testing* dans la Google Cloud Console, avec le jury en utilisateurs de test.
- URL de redirection OAuth à déclarer pour le local et pour le domaine du VPS.
- Plan B : import d'un export Google Takeout (ZIP et JSON de métadonnées).

### Réalité augmentée — conditionnelle

À ne démarrer que si tout le reste est terminé.

- Bibliothèque : MindAR (version épinglée), alternatives `webarkit` ou AR.js.
- Cibles `.mind` précompilées par le worker, une par double page.
- HTTPS obligatoire pour la caméra : Caddy en production, certificat de développement en local.
- Cibles riches en texture, papier mat obligatoire.
- Les champs AR sont absents du modèle : trois colonnes à ajouter le moment venu.

---

## Séquençage

1. **Le socle d'abord** : base, migrations, authentification, une route de bout en bout, composition Docker fonctionnelle.
2. **Un PDF laid mais complet dès la fin du premier lot fonctionnel**, même avec un gabarit unique codé en dur et trois photos.

---

## À valider tôt

1. Le recadrage rend le même résultat dans l'aperçu HTML et dans le PDF.
2. Les contraintes d'impression sont correctement écrites par `pdf-lib`.
3. La chaîne demande d'export → worker → `NOTIFY` → SSE fonctionne de bout en bout.

## Questions ouvertes

- Le `clip` de pdf-lib permet-il le recadrage sans ré-encodage ? À trancher par le code, semaines 1-2.
- Durée de souscription du VPS.
- Changement de gabarit avec perte de cadres : quelle photo est conservée.
- Catalogue de thèmes : combien, et lesquels.
