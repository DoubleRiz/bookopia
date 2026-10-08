# Architecture

## Vue d'ensemble

```
Navigateur                     React + Vite + supabase-js
   │  prépare les photos (canvas, SHA-256, EXIF)
   │  rend le PDF (pdf-lib)
   │
   │  requêtes, rpc, envoi de fichiers, avec le jeton de session
   ▼
Supabase
   ├─ Auth                     comptes, sessions
   ├─ PostgreSQL               données, contraintes, RLS, fonctions métier
   └─ Storage                  photos et PDF, buckets privés
```

**Le navigateur fait le travail, Supabase garde les données et les protège.** Il n'y a pas de serveur applicatif. Traiter une image et composer un PDF se fait dans le navigateur. Tout le reste vit dans Supabase et se voit dans Studio.

| Composant | Rôle |
|---|---|
| `apps/web` | Interface, préparation des photos, rendu PDF |
| `packages/shared` | Schémas Zod, types générés depuis la base, moteur de gabarits, fonction de rendu PDF |
| `supabase/` | Migrations SQL (tables, contraintes, RLS, fonctions), données de départ, tests |
| Supabase Auth | Inscription, connexion, sessions |
| PostgreSQL | Données, contraintes, autorisation (RLS), règles métier (fonctions SQL) |
| Supabase Storage | Originaux, vignettes, PDF |

### Alternatives écartées

| Option | Coût | Décision |
|---|---|---|
| **Supabase + travail dans le navigateur** | Règles métier en SQL ; redimensionnement moins fin qu'avec `sharp` ; rendu limité par la machine du Créateur | Retenue |
| API Node + worker + serveur à administrer | Beaucoup de code serveur à écrire, comprendre et héberger | Écartée |
| Supabase + fonctions serverless pour les photos et le PDF | Lie le projet à un hébergeur avant d'en avoir besoin | Écartée |
| Supabase + Edge Functions | Environnement Deno : `sharp` n'y fonctionne pas, le code ne se partage pas avec le front | Écartée |
| Supabase + petit service Node pour le rendu | Un processus de plus à lancer et déployer | **Repli** si le rendu dans le navigateur est trop lent |

---

## L'authentification

Supabase Auth, par email et mot de passe : `supabase.auth.signUp`, `signInWithPassword`, `signOut`. Supabase hache les mots de passe, émet et renouvelle les jetons, limite les tentatives.

**Un trigger crée la ligne `utilisateur`** à chaque inscription, avec le même identifiant que `auth.users`. `auth.uid()` désigne donc directement une ligne `utilisateur`. Le nom d'affichage est transmis dans les métadonnées de l'inscription.

**Coût** : après la déconnexion, le jeton reste valide jusqu'à son expiration (une heure par défaut). Acceptable pour le projet.

---

## L'autorisation : les RLS

Le navigateur interroge la base directement. **Chaque table a la RLS activée**, et c'est la base qui filtre :

```sql
create policy "Un créateur ne voit que ses livres"
  on projet for select
  using (utilisateur_id = auth.uid());
```

Toutes les tables d'un projet portent `projet_id`. Leurs règles appellent la même fonction, `est_mon_projet(projet_id)`, qui vérifie que le projet appartient à `auth.uid()`.

| Table | Lecture | Écriture directe depuis le navigateur |
|---|---|---|
| `utilisateur` | Sa ligne | `nom_affichage` |
| `projet` | Ses projets | `titre`, `brouillon`, suppression. Création par `creer_projet`. |
| `double_page` | Celles de ses projets | Aucune : toujours par une fonction |
| `emplacement` | Ceux de ses projets | `photo_id`, cadrage, `contenu_texte` ; la géométrie d'un cadre texte par `placer_cadre_texte` |
| `photo` | Celles de ses projets | Création, suppression |
| `export` | Celui de ses projets | Création, remplacement |
| `gabarit`, `theme` | Tout utilisateur connecté | Aucune |
| `modele_livre` | Tout le monde, visiteurs compris | Aucune |

Le navigateur n'utilise que la clé publique (`anon`). La clé `service_role`, qui ignore les RLS, n'est jamais utilisée par l'application et n'apparaît ni dans le front ni dans le dépôt.

Des tests vérifient les RLS avec deux utilisateurs : chacun ne voit et ne modifie que ses projets. Ils doivent pouvoir se montrer en direct.

---

## Les règles métier : les fonctions SQL

Tout ce qui écrit plusieurs lignes à la fois passe par une **fonction SQL appelée par `rpc`**. Une fonction s'exécute dans une transaction : à la moindre erreur, rien n'est écrit.

| Fonction | Rôle |
|---|---|
| `creer_projet` | Vérifie le modèle et les gabarits, crée le projet avec sa couverture, ses intérieures et sa 4e |
| `creer_double_page` | Crée une double page et copie la géométrie du gabarit dans ses emplacements |
| `composer_livre` | Vérifie la composition calculée par le moteur de gabarits, puis remplace les intérieures d'un coup |
| `inserer_double_page`, `deplacer_double_page`, `supprimer_double_page`, `dupliquer_double_page` | Opérations d'ordre sur les intérieures, rangs renumérotés sans trou ; `inserer_double_page` vérifie aussi la famille du gabarit |
| `changer_gabarit` | Applique un autre gabarit de la famille à une intérieure : les cadres sont recréés vides, les photos restent dans la réserve |
| `placer_cadre_texte` | Déplace ou redimensionne un cadre texte : marges de sécurité, taille minimale, pas de chevauchement |

Ces fonctions sont `security definer` : elles écrivent là où le navigateur n'a pas le droit d'écrire. **Chacune commence donc par vérifier que le projet appartient à `auth.uid()`.** C'est le point à relire en priorité.

**Validation** : le front valide d'abord avec Zod, pour le confort. La vérification qui fait foi est celle de la fonction, qui lève une erreur avec un code stable (`invalide`, `introuvable`, `interdit`, `conflit`) traduit en message par le front.

**Triggers** : réservés aux automatismes mécaniques (création de la ligne `utilisateur`, mise à jour de `modifie_le`). Une règle métier passe par une fonction appelée explicitement.

### Le verrou de projet

Deux insertions simultanées dans le même livre liraient le même ordre et produiraient deux doubles pages au même rang.

Chaque fonction d'ordre commence donc par `SELECT … FOR UPDATE` sur la ligne `projet`, filtré sur `auth.uid()`. Les opérations d'un même projet passent l'une après l'autre, et la même requête vérifie l'autorisation.

**Coût** : deux onglets sur le même livre attendent leur tour, quelques millisecondes.

**Écartés** : une unicité sur `(projet_id, position)`, qui bloque les renumérotations ; l'isolation `SERIALIZABLE`, qui fait échouer l'opération perdante au lieu de la faire attendre.

---

## L'import

Tout le traitement se fait dans le navigateur, avant l'envoi.

1. Les fichiers trop lourds ou de format refusé sont écartés dès la sélection.
2. Pour chaque fichier :
   - empreinte SHA-256 du fichier d'origine (`crypto.subtle`) ;
   - date de prise de vue lue dans l'EXIF (`exifr`, dépendance à valider) ;
   - décodage par `createImageBitmap`, qui applique l'orientation ;
   - deux images par canvas : l'original en JPEG, réduit à ce qu'exigent 300 DPI pour le plus grand cadre du catalogue, et la vignette en WebP (JPEG si le navigateur ne sait pas encoder le WebP).
3. Les deux images sont déposées dans le bucket `photos`, puis la ligne `photo` est créée.
4. Un doublon est rejeté par l'unicité `(projet_id, empreinte_fichier)`, et ses fichiers supprimés.
5. L'écran affiche l'avancement (n sur N) et les fichiers refusés.

**Coûts** :

- Le canvas compresse un peu moins finement que `sharp`. Invisible sur un livre photo.
- Si l'onglet se ferme entre l'envoi et la création de la ligne, un fichier reste orphelin. On préfère un fichier sans ligne à une ligne sans fichier. Pas de purge automatique.

---

## L'export

1. Le front télécharge les originaux des photos placées.
2. Il appelle `rendre(projet)` et affiche l'avancement page par page.
3. Il dépose le PDF dans le bucket `exports` sous une nouvelle clé, remplace la ligne `export`, puis supprime l'ancien fichier.

La ligne `export` n'est écrite qu'une fois le PDF déposé. Si le rendu échoue ou si l'onglet se ferme, rien n'est écrit et le PDF précédent reste disponible. → [`modele-donnees.md`](modele-donnees.md#export)

**Coût** : le rendu dépend de la machine du Créateur. Une trentaine de pages tient sans peine sur un ordinateur ; c'est plus lent sur téléphone. Si c'est trop lent, `rendre` peut tourner dans un petit service Node sans changer de code.

---

## Le rendu PDF

Une seule source de géométrie, deux rendus :

```
Gabarit (JSON, mm)  ──┬──►  rendu React    ──►  écran
                      └──►  rendu pdf-lib  ──►  PDF
```

Les deux doivent donner le même résultat. **Le recadrage est le point à valider en premier.**

`rendre(projet) → Uint8Array` est une fonction pure de `packages/shared`, testée avec Vitest sans navigateur ni base.

| Contrainte d'impression | Traitement |
|---|---|
| Boîtes PDF | MediaBox, TrimBox et BleedBox posées explicitement |
| Fond perdu | 3 mm sur les photos pleine page, traits de coupe |
| 300 DPI effectifs | `largeur_px / largeur_mm × 25,4 ≥ 300` par emplacement, avertissement sinon |
| Colorimétrie | RVB, l'imprimeur convertit |
| Typographie | Mêmes fichiers de police à l'écran et dans le PDF, mesure via `fontkit`, mise en lignes partagée (voir [Le texte riche](#le-texte-riche)) |

---

## Le texte riche

Un cadre texte porte un document JSON (`version`, `blocs`, `segments`), stocké en `jsonb` et décrit dans [`modele-donnees.md`](modele-donnees.md#le-texte-dun-cadre). Il ne dépend pas de l'éditeur qui le saisit.

**La mise en lignes est partagée.** `packages/shared/src/mise-en-lignes.ts` est une fonction pure : l'appelant fournit les mesures. Elle coupe le texte en mots, mesure chacun avec sa propre police (fontkit, ligatures comprises, sans crénage, comme pdf-lib) et rend des lignes de fragments positionnés. L'écran SVG et le PDF dessinent ces mêmes fragments : un texte qui tient à l'écran tient à l'impression.

**Pas de faux gras ni de faux italique.** Chaque famille déclare ses variantes réelles (`CATALOGUE_POLICES`). Une variante absente grise le bouton de l'éditeur, et le rendu ne la simule jamais. Le catalogue compte 13 familles, en fichiers TTF latin dans `packages/shared/polices/` (licence OFL) : les mêmes octets servent à l'écran, à la mesure et au PDF.

**La saisie est un éditeur Tiptap**, posé sur le cadre à la même échelle (clic sur un cadre sélectionné, comme dans Canva). Un adaptateur (`documentTexte.ts`) convertit Tiptap vers le document et inversement. Le plafond « cadre plein » est évalué par la mise en lignes partagée à chaque transaction, pas par le navigateur ; le collage est du texte brut, raccourci à ce qui tient. À la fermeture, le cadre est redessiné par le SVG exact.

| Option | Coût | Décision |
|---|---|---|
| **Tiptap** | Environ 400 Ko (127 Ko compressés), chargés à la première saisie seulement | Retenue |
| `contenteditable` maison | Collage, accessibilité et raccourcis à reconstruire | Écartée |
| Stocker le JSON de Tiptap tel quel | Le PDF dépendrait de l'éditeur | Écartée |

**Risque suivi** : pendant la frappe, le navigateur peut couper une ligne autrement que le PDF. Le CSS de la saisie est aligné (espaces de fin de ligne suspendus, ligatures actives, crénage coupé), et un test de bout en bout compare les lignes du navigateur et du module partagé pour chaque famille du catalogue.

**Déplacer et redimensionner** : un cadre texte sélectionné a 8 poignées. Le geste est accroché à une grille de 2 mm et aux bords des autres cadres, borné par les marges, puis part par `placer_cadre_texte`. L'historique garde l'emplacement entier, contenu et géométrie.

---

## Les fichiers

Deux buckets **privés** :

```
photos/
  {utilisateur_id}/{projet_id}/originaux/{cle}.jpg
  {utilisateur_id}/{projet_id}/vignettes/{cle}.webp   (ou .jpg)
exports/
  {utilisateur_id}/{projet_id}/{cle}.pdf
```

Le premier dossier est le propriétaire : la règle d'accès Storage vérifie qu'il vaut `auth.uid()`. La taille maximale et les types de fichier acceptés sont fixés dans la configuration des buckets.

- **Original en JPEG** : pdf-lib n'intègre que JPEG et PNG.
- **Vignette en WebP, repli JPEG** : le WebP est environ 30 % plus léger. Safari ne sait pas l'encoder et renvoie un PNG sans prévenir : le front vérifie `blob.type` et refait la vignette en JPEG si besoin.

Le front affiche les fichiers par URL signée de courte durée (`createSignedUrl`), délivrée seulement si la règle d'accès l'autorise.

---

## Local et mise en ligne

**Local d'abord.** `supabase start` lance dans Docker la base, l'authentification, le stockage et Studio. `npm run dev -w apps/web` lance le front. La démonstration peut tourner sans réseau.

**Mise en ligne, plus tard** : un projet Supabase hébergé (`supabase db push`) et le front compilé, servi en statique. L'hébergeur sera choisi à ce moment-là.

| Point | Traitement |
|---|---|
| Secrets | Seules l'URL et la clé `anon` sont dans le front, via un `.env` hors dépôt |
| Sauvegardes | `supabase db dump` et copie des buckets avant la démonstration |
| Projet gratuit | Mis en pause après 7 jours d'inactivité : le relancer avant toute présentation |

---

## Intégrations

### Google Photos — Picker API

Dépriorisé : l'envoi de fichiers reste le parcours par défaut.

- Session et suivi depuis le navigateur ; les fichiers sont rapatriés aussitôt (les `baseUrl` expirent en une heure), puis traités comme un import.
- **À vérifier d'abord** : le navigateur peut-il télécharger les `baseUrl` (CORS) ? Sinon, une Edge Function sert de relais.
- Rester en mode *Testing* dans Google Cloud, le jury en utilisateurs de test.
- Plan B : import d'un export Google Takeout.

### Réalité augmentée

À ne démarrer que si tout le reste est terminé.

- MindAR (version épinglée) ; cibles `.mind` compilées dans le navigateur, une par double page : à valider.
- HTTPS obligatoire pour la caméra, y compris en local.
- Papier mat, cibles riches en texture.
- Trois colonnes à ajouter au modèle le moment venu.

---

## Séquençage

1. **Le socle** : Supabase en local, migrations, RLS, authentification, `creer_projet` appelée depuis le front.
2. **Un PDF laid mais complet dès le premier lot fonctionnel**, même avec un seul gabarit et trois photos.

## À valider tôt

1. Le recadrage donne le même résultat à l'écran et dans le PDF.
2. pdf-lib écrit correctement les contraintes d'impression.
3. Un rendu de 30 pages dans le navigateur reste rapide et tient en mémoire.
4. Les tests d'accès à deux utilisateurs passent sur toutes les tables et sur Storage.

## Questions ouvertes

- Le `clip` de pdf-lib suffit-il pour recadrer ? À trancher par le code.
- Changement de gabarit avec moins de cadres : quelle photo est conservée.
- Catalogue de thèmes : combien, lesquels.
- Hébergeur du front.
