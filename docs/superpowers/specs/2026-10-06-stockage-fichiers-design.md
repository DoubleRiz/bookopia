# Stockage des fichiers sur disque — conception

Étape Notion : *Stockage des fichiers sur disque (originaux, vignettes, PDF) : arborescence, conventions de nommage, service de distribution protégé* — lot L1 · Socle technique.

**Livrable** : arborescence de stockage créée, fichiers servis uniquement via une route authentifiée. Le volume Docker n'est jamais exposé directement par le reverse proxy.

## Périmètre

Dans le périmètre :

- le paquet `@bookopia/stockage` : conventions de chemins, signature d'URL, implémentation disque de `StockageFichiers` ;
- la route `GET /fichiers/*` de l'API qui sert une URL signée ;
- le secret `SECRET_URL_SIGNEE` dans `.env.example` et Compose ;
- la mise à jour de `docs/architecture.md` (section « Les fichiers ») et de `docs/conventions.md` (structure du dépôt).

Hors périmètre :

- l'import (`sharp`, écriture des originaux et vignettes) et le rendu PDF : ils utiliseront ce paquet dans leurs étapes ;
- l'émission d'URL signées par les routes de photos et d'export ;
- le branchement du worker, qui arrive avec le rendu PDF ;
- la purge des fichiers orphelins ;
- l'arrondi des expirations pour stabiliser les URL d'un affichage à l'autre (à rouvrir si la grille de vignettes recharge trop).

## Décisions

### Distribution : l'API sert l'URL signée

`architecture.md` prévoit que l'API vérifie l'autorisation puis délivre une URL signée à durée courte. Sur disque, il n'existe pas de service tiers pour servir cette URL : c'est l'API qui la vérifie et diffuse le fichier. Avec un stockage objet, ce rôle passerait au fournisseur sans toucher aux appelants.

| Option | Coût | Décision |
|---|---|---|
| **A. L'API vérifie la signature HMAC et diffuse** | Un secret de plus ; l'API diffuse des octets | Retenue |
| B. Caddy diffuse, l'API autorise par `forward_auth` | Volume monté dans Caddy, contraire à la note Notion ; configuration plus difficile à tester | Écartée |
| C. Route protégée par cookie de session, sans signature | Abandonne `urlSignee`, donc rouvre une décision ; une requête en base par vignette | Écartée |

### Emplacement du code : `packages/stockage`

L'API écrit originaux et vignettes, le worker écrira les PDF : le code est partagé entre deux `apps`, il passe donc par un paquet. `packages/shared` est aussi importé par le front, où `node:fs` et `node:crypto` n'ont pas leur place. Un paquet dédié garde la frontière par construction ; coût : un paquet de plus et une ligne dans `conventions.md`.

Écartés : un point d'entrée `@bookopia/shared/stockage` (du code Node dans un paquet importé par le front, protégé seulement par la discipline) et un import relatif depuis `apps/api` (interdit par les conventions).

### Arborescence

Sous la racine `DOSSIER_FICHIERS` :

```
projets/
  {projetId}/
    originaux/{cle}.jpg
    vignettes/{cle}.webp
    exports/{cle}.pdf
```

- `cleStockage` (de `Photo` comme d'`Export`) reste un **UUID v7 nu**, généré par l'API, opaque. Le chemin se déduit de `(projetId, cle)`. Original et vignette d'une photo partagent la même clé : aucune colonne ajoutée.
- Regrouper par projet rend la suppression d'un projet ou d'un compte triviale (un dossier). Coût : un fichier changerait de chemin en changeant de projet, ce qui n'arrive jamais.
- **Original en JPEG** : pdf-lib n'intègre que JPEG et PNG, et l'original est de toute façon ré-encodé puisqu'il est redimensionné à 300 DPI. Coût : une perte de génération, invisible à qualité 90.
- **Vignette en WebP** : lue seulement par le navigateur, environ 30 % plus légère que le JPEG sur une grille de 300. Coût : un second format, produit par `sharp` sans dépendance supplémentaire.

## Le paquet `@bookopia/stockage`

```
packages/stockage/src/
  chemins.ts           cheminOriginal / cheminVignette / cheminExport
  signature.ts         signer / verifierSignature
  stockage-disque.ts   creerStockageDisque({ racine, secret })
  index.ts
```

Aucune dépendance externe : `node:fs`, `node:path`, `node:crypto`. Dépendants : `apps/api` (et `apps/worker` plus tard). Jamais `apps/web`.

### Chemins

```ts
cheminOriginal(projetId: string, cle: string): string  // projets/{projetId}/originaux/{cle}.jpg
cheminVignette(projetId: string, cle: string): string  // projets/{projetId}/vignettes/{cle}.webp
cheminExport(projetId: string, cle: string): string    // projets/{projetId}/exports/{cle}.pdf
```

Chaque fonction lève une erreur si `projetId` ou `cle` n'est pas un UUID : un chemin construit ne peut contenir ni `..` ni `/`. Les chemins sont relatifs, séparés par `/`.

### Interface

```ts
interface StockageFichiers {
  ranger(chemin: string, contenu: Buffer): Promise<void>;
  lire(chemin: string): Promise<Buffer>;
  flux(chemin: string): Promise<Readable>;
  supprimer(chemin: string): Promise<void>;
  urlSignee(chemin: string, dureeSecondes: number): Promise<string>;
}
```

`flux` est le seul ajout à l'interface documentée : la route doit diffuser un PDF de plusieurs dizaines de Mo sans le charger en mémoire. Coût : une méthode de plus à réimplémenter pour un stockage objet, dont les SDK renvoient aussi un flux.

Comportements de l'implémentation disque :

- **Confinement** : tout chemin est résolu sous la racine et rejeté s'il en sort, pour chaque méthode. Redondant avec les fonctions de chemin pour les appelants internes, indispensable pour la route qui reçoit un chemin de l'extérieur.
- **`ranger` atomique** : écriture dans un fichier temporaire du même dossier, puis `rename`. Un fichier à moitié écrit n'est jamais lisible. Les dossiers manquants sont créés.
- **`lire` et `flux`** sur un fichier absent lèvent une erreur reconnaissable (`FichierIntrouvable`).
- **`supprimer` idempotent** : un fichier absent n'est pas une erreur.

### Signature

- Message signé : `chemin + "\n" + expire`, où `expire` est un instant Unix en secondes.
- HMAC-SHA256 avec `SECRET_URL_SIGNEE`, encodé en base64url.
- Vérification : expiration dépassée → refus ; sinon comparaison par `timingSafeEqual` (longueurs différentes → refus sans comparer).
- `urlSignee(chemin, duree)` renvoie `/api/fichiers/{chemin}?expire={expire}&signature={signature}`. Chemin relatif, identique en développement (proxy Vite) et en production (Caddy), qui retirent tous deux `/api`.
- Le secret fait au moins 32 octets ; `creerStockageDisque` refuse un secret plus court.

## La route `GET /fichiers/*`

Dans l'API, enregistrée par `construireApp`.

1. Paramètres de requête validés par Zod : `expire` entier positif, `signature` base64url non vide. Invalide → **400** `invalide`.
2. Signature invalide ou expirée → **403** avec un nouveau code métier `interdit` ajouté à `CodeErreurMetier` et `STATUT_PAR_CODE`. Le front saura redemander une URL.
3. Extension autre que `.jpg`, `.webp`, `.pdf`, chemin hors racine ou fichier absent → **404** `introuvable`.
4. Sinon **200**, fichier diffusé par `flux`, avec :
   - `Content-Type` : `image/jpeg`, `image/webp` ou `application/pdf` ;
   - `X-Content-Type-Options: nosniff` ;
   - `Cache-Control: private, max-age={secondes restantes avant expiration}` ;
   - `Content-Disposition: attachment` pour les PDF.

**Aucune requête en base** : l'autorisation a été vérifiée à l'émission de l'URL, la signature en est la preuve.

## Branchement

- `construireApp(prisma, options)` devient `construireApp({ prisma, stockage }, options)` ; les tests injectent un stockage pointé sur un dossier temporaire.
- `apps/api/src/index.ts` exige `DOSSIER_FICHIERS` et `SECRET_URL_SIGNEE` au démarrage et refuse de démarrer sans eux.
- `.env.example` : `SECRET_URL_SIGNEE=` avec la commande pour en générer un (`openssl rand -base64 48`).
- `docker-compose.yml` : `SECRET_URL_SIGNEE: ${SECRET_URL_SIGNEE}` dans l'ancre `env-app`.
- Caddy inchangé : `/api/*` est déjà relayé, aucun `file_server` sur le volume.

## Tests

Unitaires, `packages/stockage` :

- chemins : format attendu ; refus d'un identifiant non UUID, de `..`, de `/` ;
- signature : valide acceptée ; expirée, altérée, signée pour un autre chemin, longueur différente refusées ;
- stockage disque (dossier temporaire) : `ranger` puis `lire` ; création des dossiers ; aucun fichier temporaire résiduel ; refus d'un chemin qui sort de la racine ; `supprimer` d'un fichier absent sans erreur ; `flux` restitue le contenu ; `lire` d'un absent lève `FichierIntrouvable` ; secret trop court refusé.

Intégration, `apps/api`, via `app.inject` :

- 200 avec les bons en-têtes pour JPEG, WebP et PDF ;
- 403 pour une URL expirée ou altérée ;
- 404 pour un fichier absent avec signature valide, et pour une extension non reconnue ;
- 400 pour une requête sans `expire` ou `signature`.

## Documentation

- `docs/architecture.md`, section « Les fichiers » : arborescence, JPEG et WebP, diffusion de l'URL signée par l'API sur disque, ajout de `flux`, options B et C écartées avec leur coût.
- `docs/conventions.md`, structure du dépôt : ligne `stockage/` sous `packages/`.
