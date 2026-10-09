# Import depuis Google Photos

Lot L8 · Google Photos. Étapes 52 (Google Cloud Console), 53 (session Picker et suivi), 54 (rapatriement avant expiration des `baseUrl`). Écran : E5 Import, `/livre/:id/import`, état « Attente du sélecteur Google ». Règles : RG-01 à RG-05.

L'étape 52 est faite : projet Google Cloud, Google Photos Picker API activée, mode *Testing*, scope `photospicker.mediaitems.readonly`, ID client Web pour `http://localhost:5173`. L'étape 55 (plan B Takeout) reste hors de ce spec.

## Objectif

Dans la modale d'import, le Créateur choisit entre ses fichiers et Google Photos. Côté Google, il choisit ses photos dans l'interface de Google ; dès qu'il valide, elles arrivent dans la réserve par le même chemin qu'un fichier local : mêmes contrôles, même dédoublonnage, même bilan.

## Vérifié avant de concevoir

Sonde jetable du 9 octobre 2026, depuis `http://localhost:5173` :

| Question | Résultat |
|---|---|
| L'API Picker répond-elle au navigateur (CORS) ? | Oui : création, suivi, liste et suppression de session |
| Le navigateur peut-il télécharger une `baseUrl` ? | Oui, HTTP 200, en original (`=d`) comme en redimensionné |
| Format et poids | `image/jpeg`, 1,4 à 1,7 Mo pour une photo de téléphone de 1856 × 4096 |
| EXIF | Présent, y compris en `=d` |
| Fenêtre du sélecteur ouverte par `window.open` après l'appel de création | Bloquée par le navigateur |

Une `baseUrl` répond aussi sans jeton : c'est une adresse secrète d'environ une heure. On envoie quand même le jeton, comme Google le demande.

## Décisions

| Sujet | Décision | Coût assumé |
|---|---|---|
| Où se fait le rapatriement | Dans le navigateur, qui télécharge chaque `baseUrl` et la passe à `importer` | Le Créateur garde la page ouverte, comme pour un import local. Écartée : Edge Function relais, inutile puisque le CORS passe |
| Obtention du jeton Google | Script Google Identity Services, *token client*, chargé à la première demande | Un script externe depuis `accounts.google.com`. Écartées : redirection OAuth écrite à la main (une trentaine de lignes, un `state` à vérifier, un rechargement complet), connexion Google par Supabase Auth (mélange l'identité Bookopia et l'accès aux photos) |
| Où vit le jeton | En mémoire du module, jusqu'à son expiration (une heure) | Un rechargement redemande le consentement. Rien n'est écrit dans le navigateur |
| Ouverture du sélecteur | Un lien `target="_blank"` vers `pickerUri`, cliqué par le Créateur | Deux clics (« Choisir dans Google Photos », puis « Ouvrir Google Photos »). Un `window.open` après un appel réseau est bloqué |
| Lancement de l'import | Automatique dès que la session passe à `mediaItemsSet` | Pas de récapitulatif avant envoi : le Créateur a déjà validé chez Google, et les `baseUrl` expirent |
| Quand télécharger | Pendant l'import, photo par photo, dans la limite des trois en parallèle | `importer` reçoit des sources au lieu de fichiers. Tout télécharger d'avance garderait des centaines de Mo en mémoire |
| Format et taille | `filtrer` s'applique après téléchargement ; un refus devient un échec du bilan | Le poids n'est connu qu'une fois le fichier reçu : les octets d'un fichier refusé ont transité |
| Vidéos | Écartées avant téléchargement (`type !== "PHOTO"`), comptées dans le bilan | Aucune |
| Reprise après rechargement | Aucune : session et jeton vivent en mémoire | Une page rechargée pendant l'attente fait recommencer. Le sélecteur s'ouvrant dans un autre onglet, la modale reste ouverte |
| Mélange des sources | Un envoi vient de l'appareil ou de Google, pas des deux | Deux envois si le Créateur veut les deux |
| ID client absent | La colonne Google affiche « Google Photos n'est pas configuré » | Aucune : l'import local reste entier |

Aucune migration : une photo Google devient une ligne `photo` comme une autre. L'unicité `(projet_id, empreinte_fichier)`, les limites du bucket `photos` et la RLS s'appliquent telles quelles.

## Découpage

| Fichier | Rôle |
|---|---|
| `apps/web/src/import/google/connexion.ts` | Charge le script Google Identity Services une fois, à la demande. `demanderJeton()` rend le jeton en mémoire s'il lui reste plus d'une minute, sinon ouvre le consentement. `googleConfigure()` dit si `VITE_GOOGLE_CLIENT_ID` est présent |
| `apps/web/src/import/google/selecteur.ts` | Appels à `photospicker.googleapis.com/v1`, `fetch` injectable : `creerSession`, `attendreSelection` (suit `pollInterval`, s'arrête à `timeoutIn` ou sur `AbortSignal`), `listerMedias` (pagination par `nextPageToken`), `supprimerSession`, `telecharger(media)` qui rend un `File` |
| `apps/web/src/import/google/types-gis.d.ts` | Les types du script Google utilisés ici, sans paquet `@types` |
| `apps/web/src/import/importer.ts` | Reçoit des `Source` au lieu de `File` |
| `apps/web/src/ecrans/ImportPhotos.tsx` | Étape de sélection en deux colonnes ; lance l'import avec les sources Google |
| `apps/web/src/ecrans/ColonneGooglePhotos.tsx` | La colonne de droite et ses états |

```ts
type Source = { nom: string; obtenir: () => Promise<File> };
```

- Fichier local : `{ nom: fichier.name, obtenir: async () => fichier }`.
- Média Google : `{ nom: filename, obtenir: () => telecharger(jeton, media) }`. Le `File` porte `filename`, `mimeType` et `lastModified` tiré de `createTime`. La date de prise de vue reste lue dans l'EXIF.

## Flux

1. « Choisir dans Google Photos » : `demanderJeton()`, consentement si besoin.
2. `creerSession()` ; la colonne affiche le lien « Ouvrir Google Photos ↗ » vers `pickerUri` et « Annuler ».
3. `attendreSelection()` interroge la session au rythme de `pollInterval`.
4. `mediaItemsSet` : `listerMedias()`, vidéos écartées, sources construites, la modale passe en « Envoi n sur N » avec `importer`.
5. Pour chaque source, `importer` appelle `obtenir()`, applique `filtrer`, puis la suite actuelle : empreinte, préparation, envoi.
6. `supprimerSession()` dans un `finally` : fin, annulation, fermeture de la modale ou erreur.

## Erreurs

| Cas | Comportement |
|---|---|
| Consentement refusé, fenêtre fermée ou bloquée | Message dans la colonne Google, bouton pour réessayer |
| `timeoutIn` dépassé sans validation | « Le sélecteur Google a expiré. Recommencez. » |
| Annulation, fermeture de la modale | Le suivi s'arrête, la session est supprimée |
| Téléchargement d'une photo en échec | Échec `telechargement` dans le bilan, la file continue |
| Format ou taille refusés après téléchargement | Échec `format` ou `taille` dans le bilan, la file continue |
| Réponse 401 de Google en cours d'import | La file s'arrête, comme pour une session Supabase expirée. Message : « Votre accès à Google Photos a expiré. Reconnectez-vous : les photos déjà arrivées seront sautées. » Le jeton en mémoire est oublié |
| Erreur réseau à la création ou au suivi | Message dans la colonne Google, bouton pour réessayer |

## Interface

Étape de sélection de E5, deux colonnes de même hauteur, empilées sous 640 px :

- **Gauche, « Depuis cet appareil »** : icône d'import, la zone de dépôt actuelle et son aide (JPEG, PNG ou WebP, 10 Mo au plus). Les fichiers refusés et le bouton « Importer » restent sous les colonnes.
- **Droite, « Depuis Google Photos »** :

| État | Contenu |
|---|---|
| Repos | Texte court, bouton « Choisir dans Google Photos » |
| Connexion | Bouton inactif, « Connexion à Google… » |
| Attente du sélecteur Google | Lien « Ouvrir Google Photos ↗ », « Choisissez vos photos dans l'onglet Google Photos, puis revenez ici. », bouton « Annuler » |
| Erreur | Message, bouton « Réessayer » |
| Non configuré | « Google Photos n'est pas configuré. » |

Pendant l'attente, la zone de gauche reste utilisable, mais un dépôt local annule l'attente Google.

Le bilan gagne une ligne « n vidéos écartées : non prises en charge » et les raisons d'échec `telechargement` (« Téléchargement impossible »), `format` et `taille` (mêmes libellés que les refus à la sélection).

## Hors périmètre

- Reprise de l'attente ou de l'import Google après rechargement.
- Plan B Takeout (étape 55).
- Publication de l'application Google et vérification du scope : le projet reste en *Testing*, le jury est ajouté en utilisateur de test.
- Plafond du nombre de photos par sélection : celui de Google (2000) s'applique.

## Tests

- `selecteur.test.ts`, `fetch` simulé : session créée puis suivie jusqu'à `mediaItemsSet` ; expiration à `timeoutIn` ; arrêt sur `AbortSignal` ; pagination de `listerMedias` ; `telecharger` envoie le jeton et rend un `File` nommé et daté ; 401 traduit en erreur dédiée.
- `importer.test.ts`, adapté aux sources : les cas actuels passent inchangés ; `obtenir` en échec donne un échec `telechargement` ; fichier trop lourd ou au mauvais format après `obtenir` donne un échec `format` ou `taille` ; 401 Google arrête la file.
- À la main, avec le compte Google du Créateur : le parcours complet, une vidéo dans la sélection, l'annulation, le refus de consentement.
