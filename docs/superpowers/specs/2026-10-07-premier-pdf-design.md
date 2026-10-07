# Premier PDF de bout en bout

Lot L2 · Premier PDF de bout en bout. Étapes 18 (recadrage par chemin de découpe), 19 (rendu pdf-lib minimal), 20 (boîtes, fond perdu, traits de coupe), 21 (export dans le navigateur), 22 (premier PDF complet).

## Objectif

Le Créateur ouvre un livre, remplit ses emplacements avec la réserve, exporte, et télécharge un PDF qui s'ouvre dans un lecteur et porte les contraintes d'impression. Laid, mais complet.

## Décisions

| Sujet | Décision | Coût assumé |
|---|---|---|
| Photos dans les emplacements | Fonction SQL `remplir_emplacements`, appelée par `rpc` depuis un bouton provisoire | Une fonction que L5 reprendra ou remplacera |
| Une page PDF | Une double page : 420 × 210 mm de format fini | Certains imprimeurs veulent des pages simples : découpe possible en L7 |
| Recadrage | Image entière dessinée sous un chemin de découpe rectangulaire (`re W n`), JPEG intégré sans réencodage | Toute l'image est embarquée, même la partie masquée. Repli si le `clip` échoue : réencodage de la zone visible |
| Repère du cadrage | Calculé sur le cadre prolongé du fond perdu | L'écran (L5, L6) doit faire le même calcul et masquer les 3 mm, sinon un écart d'environ 1,5 % |
| Emplacements texte | Ignorés | `contenu_texte` est vide sans éditeur ; polices et `fontkit` en L6 et L7 |
| Droits de `remplir_emplacements` | `security invoker` | Écart avec la convention « appelable = definer » : la fonction n'écrit que ce que le navigateur peut déjà écrire, la RLS s'applique en plus |
| Dépendance | `pdf-lib` dans `packages/shared` | Déjà actée par la règle 4 de `CLAUDE.md` |
| Vérification visuelle | `pdftoppm`, présent sur la machine | Outil de contrôle, pas une dépendance du projet |

## Découpage

**`packages/shared`**

| Fichier | Rôle |
|---|---|
| `cadrage.ts` | Calculs purs : prolongement d'un cadre par le fond perdu, zone visible de l'image |
| `rendu-pdf.ts` | `rendre(livre) → Promise<Uint8Array>`, s'appuie sur `cadrage.ts` |

Entrée de `rendre`, sans accès réseau ni base :

```ts
type LivreARendre = {
  fond: string; // couleur de fond du thème, « #RRGGBB »
  doubles_pages: {
    emplacements: {
      x: number; y: number; largeur: number; hauteur: number; // mm, repère de la double page
      nature: "photo" | "texte";
      photo: { octets: Uint8Array; largeur_px: number; hauteur_px: number } | null;
      cadrage_x: number; cadrage_y: number; cadrage_zoom: number;
    }[];
  }[]; // dans l'ordre du livre : couverture, intérieures, 4e
};
```

**`supabase/migrations/`** : `remplir_emplacements`, commentée en français. **`supabase/tests/`** : ses tests pgTAP.

**`apps/web/src/api/exports.ts`** : lire le livre à rendre (doubles pages, emplacements, couleur du thème, photos posées), télécharger un original, déposer un PDF, upsert de `export` sur `projet_id`, lire l'export d'un livre, supprimer un fichier, URL signée du PDF, appeler `remplir_emplacements`.

**`apps/web/src/export/`**

| Fichier | Rôle |
|---|---|
| `charger.ts` | Assemble le `LivreARendre`. Télécharge chaque original une seule fois, même posé deux fois, trois à la fois. |
| `exporter.ts` | Orchestrateur : charger → `rendre` → dépôt → upsert → suppression de l'ancien fichier. Publie l'étape en cours. Reçoit ses appels Supabase en paramètres, pour les tests. |

**Écran** : `LivreEnCours.tsx` (`/livre/:id`) gagne deux boutons et le lien de téléchargement.

## Géométrie d'une page PDF

Millimètres convertis en points (`× 72 / 25,4`). Origine pdf-lib en bas à gauche : les `y` des gabarits (origine en haut) sont inversés.

| Boîte | Taille (mm) | Position |
|---|---|---|
| MediaBox | 436 × 226 | toute la page |
| BleedBox | 426 × 216 | décalée de 5 mm |
| TrimBox | 420 × 210 | décalée de 8 mm |

- **Traits de coupe** : 5 mm, filet de 0,25 pt noir, dans la marge entre BleedBox et MediaBox, dans le prolongement des quatre bords de la TrimBox.
- **Fond** : rectangle à la couleur du thème sur toute la BleedBox.
- **Fond perdu** : chaque bord d'un cadre photo qui touche un bord de la double page (`x = 0`, `y = 0`, `x + largeur = 420`, `y + hauteur = 210`) est prolongé de 3 mm. Les autres bords ne bougent pas.
- **Emplacement photo vide** : rectangle gris clair à sa place, sans prolongement.

## Recadrage

Pour un cadre prolongé de proportion `r = largeur / hauteur` et une image de `L × H` px :

1. Zone de base : la plus grande zone de proportion `r` contenue dans l'image (`L × L/r` ou `H·r × H`).
2. Zone visible : la zone de base divisée par `cadrage_zoom` sur chaque axe.
3. Centre : `(cadrage_x × L, cadrage_y × H)`, ramené pour que la zone reste dans l'image.
4. Dessin : l'image entière, à l'échelle `largeur_cadre / largeur_zone`, décalée pour que la zone visible tombe sur le cadre, sous un chemin de découpe au rectangle du cadre.

Pour l'étape 18, le `clip` est validé quand :

- un test vérifie que le flux de l'image dans le PDF est identique, octet pour octet, au JPEG d'origine ;
- le rendu `pdftoppm` d'une photo à damier connu montre la bonne zone au bon endroit, pour un zoom de 1 et de 2 et pour un centre décentré.

## Remplissage

`remplir_emplacements(p_projet_id uuid) → integer`

1. Lève une erreur si `est_mon_projet(p_projet_id)` est faux. Verrouille le projet par `verrouiller_projet`.
2. Emplacements cibles : nature `photo`, `photo_id` vide, dans l'ordre couverture, intérieures par `position`, 4e, puis par `indice`.
3. Photos : celles du livre posées nulle part, par `cree_le` puis `id`.
4. Associe les deux listes rang par rang, jusqu'à épuisement de l'une. Cadrage `0,5 / 0,5 / 1`.
5. Renvoie le nombre de photos posées.

## Flux de l'export

1. **Chargement** : lecture du livre, puis téléchargement des originaux posés (`{uid}/{projet}/originaux/{cle}.jpg`). Avancement : n sur N.
2. **Rendu** : `rendre(livre)`.
3. **Dépôt** de `{uid}/{projet}/{cle}.pdf` dans le bucket `exports`, sous une clé neuve (`crypto.randomUUID()`).
4. **Upsert** de la ligne `export` (`projet_id`, `cle_stockage`). `cree_le` est remis à l'heure par trigger.
5. **Suppression** de l'ancien PDF s'il y en avait un.

Alerte `beforeunload` de l'étape 1 à l'étape 4.

## Erreurs

L'export réussit en entier ou n'écrit rien : jamais de PDF partiel, jamais de ligne `export` sans fichier.

| Cas | Conduite |
|---|---|
| Un original manquant ou un téléchargement en échec | Un nouvel essai, puis échec de l'export. Rien n'est déposé. |
| Rendu en erreur | Échec, rien n'est déposé. |
| Dépôt refusé (plus de 50 Mo, réseau) | Échec, message. L'ancien PDF reste disponible. |
| Upsert refusé | Suppression du PDF qui vient d'être déposé, échec. |
| Suppression de l'ancien PDF en échec | Ignorée : un orphelin est accepté. |
| Session expirée | Arrêt, renvoi vers la connexion avec l'adresse demandée. |
| Remplissage sur le livre d'un autre | Refusé par la fonction, puis par la RLS. |

## Interface

Sur `/livre/:id`, sous la réserve. Le vrai écran d'export arrive en L7.

| Élément | Contenu |
|---|---|
| **Remplir les emplacements** (provisoire) | Appelle `remplir_emplacements`, puis affiche « N photos posées » ou « Aucun emplacement à remplir » |
| **Exporter le PDF** | Désactivé pendant l'export |
| En cours | « Téléchargement des photos n sur N », puis « Composition du PDF », puis « Enregistrement » |
| Terminé | Lien **Télécharger le PDF**, par URL signée d'une heure |
| Échec | Message avec la raison ; le lien de l'export précédent reste affiché s'il existe |
| Au chargement | Si un export existe, le lien **Télécharger le PDF** est affiché |

## Tests

- **Vitest, `cadrage.ts`** : zone de base pour une image plus large et plus haute que le cadre, zoom, centre ramené dans l'image, prolongement selon les bords touchés.
- **Vitest, `rendu-pdf.ts`** : livre codé en dur de trois photos sur un gabarit. Nombre de pages, valeurs des trois boîtes, JPEG intégré à l'identique, emplacement vide rendu sans erreur.
- **Vitest, `charger.ts` et `exporter.ts`** : faux appels Supabase. Ordre des opérations, original téléchargé une fois, nettoyage sur échec de l'upsert, ancien fichier supprimé seulement après l'upsert.
- **pgTAP, `remplir_emplacements`** : ordre de remplissage, emplacements remplis ignorés, photo déjà posée non réutilisée, réserve vide, livre d'un autre refusé.
- **Étape 22, à la main** : importer, remplir, exporter, télécharger. Ouverture dans un lecteur PDF, rendu `pdftoppm`, lecture des boîtes.

## Pour la documentation

Une fois le lot validé, `docs/architecture.md` pourra sortir « Le `clip` de pdf-lib suffit-il pour recadrer ? » de la liste « À trancher », avec la réponse obtenue. Ce n'est pas fait dans ce lot sans demande.
