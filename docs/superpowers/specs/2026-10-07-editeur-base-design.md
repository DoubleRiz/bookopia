# Éditeur de base

Lot L6 · Éditeur, premier sous-lot (6a). Étapes 41 (navigation dans les doubles pages), 43 (glisser-déposer d'une photo dans un emplacement), 44 (recadrage). Écran : E7 Éditeur.

Le lot L6 est découpé en cinq sous-lots, chacun avec sa spec et sa PR : 6a éditeur de base, 6b changement de gabarit (étape 42), 6c texte et thèmes (étapes 40 et 45), 6d couverture et 4e (étape 46), 6e annuler / refaire (étape 47).

## Objectif

Le Créateur travaille son livre double page par double page : il navigue entre les intérieures, en ajoute, en déplace, en duplique, en supprime ; il pose une photo de la réserve dans un cadre, à la souris ou au clavier, la recadre, vide un cadre. Chaque geste s'affiche tout de suite et s'enregistre seul.

## Décisions

| Sujet | Décision | Coût assumé |
|---|---|---|
| Glisser-déposer | API native HTML5 (`draggable`, `dragover`, `drop`), sans dépendance | Pas de glisser au doigt ; l'équivalent clavier est écrit à la main |
| État de l'éditeur | Réducteur local (`useReducer`) initialisé par le loader ; écritures directes sur `emplacement`, affichées avant la réponse, retirées si la base refuse | Deux chemins d'écriture : `update` pour les emplacements, rpc pour la structure |
| Disposition | Une double page à la fois, bande de navigation en bas (design system §11) | On ne voit plus le livre entier d'un coup d'œil ; la bande le résume |
| Page courante | Dans l'adresse : `/livre/:id?page=<double_page_id>` | Un paramètre de plus à garder cohérent après une suppression |
| Ajout d'une double page | Insérée après la page courante, avec le gabarit par défaut de la famille | Toutes les pages ajoutées ont la même mise en page jusqu'à 6b |
| Gabarit par défaut | Le gabarit intérieur actif de la famille qui a le moins de cadres photo ; à égalité, le premier du catalogue (ordre des identifiants) | « Pleine double page » (Généreux), « Duo horizontal » (Rythmé, qui n'a pas de gabarit à une photo), « Panoramique et légende » (Raconté) |
| Barre d'outils d'un cadre | Recadrer, Remplacer, Vider | Pas de poignées, pas de flèches ±1 mm, pas de « Pivoter » : le modèle interdit de déplacer un cadre et ne stocke pas de rotation (écart #3 du design system) |
| Recadrage | Surcouche non adressée : photo entière, zone visible à déplacer, zoom | Le cadrage n'est pas modifiable directement dans la double page |
| Suppression d'une double page | Modale de confirmation | Le toast « Annuler » arrive avec 6e |
| Dernière intérieure | Sa suppression reste permise | État « livre sans double page intérieure », avec le « + » |
| Hors-ligne | Bandeau, gestes désactivés (spécifications fonctionnelles, §4) | Le « enregistré sur cet appareil » du design system n'est pas fait |
| Couverture et 4e | Absentes de la bande | Éditées sur E8 (6d) |
| Cadres texte | Affichés, non éditables | Saisie en 6c |

## Découpage

**`supabase/migrations/`** : nouvelle migration qui remplace `inserer_double_page` ; elle vérifie en plus que le gabarit est de la famille du modèle d'origine du livre. **`supabase/tests/`** : cas ajoutés à `fonctions_metier_test.sql`.

**`packages/shared/src/cadrage.ts`** : gagne `dpiEffectif(emplacement, photo)` et `niveauResolution(dpi)`.

**`apps/web/src/editeur/`**, nouveau dossier :

| Fichier | Rôle |
|---|---|
| `etatEditeur.ts` | Réducteur pur : `poser`, `vider`, `recadrer`, `retablir`, `remplacerDoublesPages`, `selectionner` |
| `fileEcritures.ts` | File d'écriture : une écriture à la fois, dans l'ordre des gestes ; statut d'enregistrement ; rejeu sur « Réessayer » |
| `gabaritParDefaut.ts` | Choix du gabarit d'une double page ajoutée |
| `Editeur.tsx` | Écran : en-tête et statut, double page courante, barre d'outils, réserve, bande |
| `BandeDoublesPages.tsx` | Miniatures des intérieures, réordonnancement, « + », menu Dupliquer / Déplacer / Supprimer |
| `SurcoucheRecadrage.tsx` | Recadrage d'un emplacement |
| `Reserve.tsx` | Réserve, sortie de `LivreEnCours.tsx` : photos glissables, photos posées à 45 %, suppression existante conservée |

**`apps/web/src/api/doublesPages.ts`** : `listerDoublesPages` lit aussi `contenu_texte` ; nouvelles fonctions `poserPhoto`, `viderEmplacement`, `recadrer`, `insererDoublePage`, `deplacerDoublePage`, `dupliquerDoublePage`, `supprimerDoublePage`.

**`apps/web/src/composants/DoublePage.tsx`** : reste le seul rendu SVG d'une double page. Il gagne les cadres focalisables et cliquables, la sélection (contour 2 px et halo), la cible de dépôt et le badge de résolution. Sans ces propriétés, il rend comme aujourd'hui (miniatures de la bande, tests existants).

**`apps/web/src/ecrans/LivreEnCours.tsx`** : garde le loader, les actions « composer » et « supprimer une photo », l'import et l'export ; le corps de l'écran devient `Editeur`. « Composer le livre » passe dans l'en-tête.

## L'état de l'éditeur

```ts
type EtatEditeur = {
  doublesPages: DoublePageLue[];        // intérieures, dans l'ordre
  selection: string | null;             // id de l'emplacement sélectionné
};

type Action =
  | { type: "poser"; emplacementId: string; photoId: string }               // cadrage 0,5 / 0,5 / 1
  | { type: "vider"; emplacementId: string }
  | { type: "recadrer"; emplacementId: string; cadrage: Cadrage }
  | { type: "retablir"; emplacement: EmplacementLu }                        // retour arrière après un refus
  | { type: "remplacerDoublesPages"; doublesPages: DoublePageLue[] }
  | { type: "selectionner"; emplacementId: string | null };
```

- Le réducteur est pur et ne connaît pas Supabase.
- Avant chaque écriture d'emplacement, l'éditeur garde l'emplacement tel qu'il était ; si l'écriture échoue, il envoie `retablir` avec cette copie.
- Vider garde l'ancien cadrage en base, comme la contrainte `emplacement_coherence_nature` le permet ; poser l'écrase.

## Écritures

**Emplacement** (poser, vider, recadrer) :

1. Le réducteur applique le geste ; le statut passe à « Enregistrement… ».
2. La file envoie `update emplacement` (colonnes `photo_id`, `cadrage_x`, `cadrage_y`, `cadrage_zoom`, déjà ouvertes au navigateur). Une seule écriture à la fois : deux gestes rapides sur le même cadre arrivent dans l'ordre.
3. Succès : « Enregistré ». Échec : `retablir`, statut « Non enregistré · Réessayer » ; « Réessayer » rejoue le geste.

La RLS et les contraintes de la table restent les seules gardiennes : photo d'un autre livre (clé étrangère composite), cadre texte, cadrage hors bornes.

**Structure** (ajouter, déplacer, dupliquer, supprimer) : la rpc existante, puis relecture des doubles pages et `remplacerDoublesPages`. La bande est désactivée pendant l'appel. Une écriture d'emplacement en attente est terminée avant.

| Geste | Rpc | Page courante après |
|---|---|---|
| « + » | `inserer_double_page(projet, gabarit par défaut, rang courant + 1)` | La nouvelle |
| Déplacer | `deplacer_double_page(id, rang)` | Celle qu'on a déplacée |
| Dupliquer | `dupliquer_double_page(id)` | La copie |
| Supprimer | `supprimer_double_page(id)`, après confirmation | La suivante, sinon la précédente, sinon aucune |

## `inserer_double_page`

Signature inchangée. Ajout, après `verrouiller_projet` : le gabarit doit être de la famille du modèle d'origine du livre, sinon `invalide` avec un détail en français. Même règle que `composer_livre` ; `creer_double_page` continue de vérifier qu'il est actif et de rôle `interieur`.

## Gestes

| Geste | Souris | Clavier |
|---|---|---|
| Sélectionner un cadre | Clic | Tab jusqu'au cadre, Entrée |
| Poser une photo | Glisser de la réserve vers un cadre photo | Cadre sélectionné, puis Entrée sur une photo de la réserve |
| Remplacer | Glisser une autre photo, ou bouton Remplacer qui place le focus dans la réserve | Bouton Remplacer, puis Entrée sur une photo |
| Recadrer | Bouton Recadrer, ou double-clic sur un cadre rempli | Entrée sur un cadre rempli sélectionné |
| Vider | Bouton Vider | Suppr |
| Réordonner les pages | Glisser une miniature dans la bande | Menu de la miniature : Déplacer à gauche, Déplacer à droite |
| Désélectionner, fermer | Clic dans le vide | Échap |

- Un cadre texte n'est pas une cible de dépôt.
- Pendant un glisser, le cadre survolé prend le contour de sélection.
- Les boutons et miniatures font au moins 44 px.

## Recadrage

La surcouche affiche la photo entière (vignette) et, par-dessus, la zone visible aux proportions du cadre.

- Glisser la zone la déplace ; le curseur et la molette règlent le zoom de 1 à 4 ; les flèches déplacent la zone, Maj + flèches plus vite.
- Le centre et le zoom sont bornés par `zoneVisible` : la zone ne sort jamais de l'image. La valeur enregistrée est le centre effectif, pas celui demandé.
- Valider écrit le cadrage par la file ; Annuler et Échap ferment sans rien écrire.
- Le badge de résolution est recalculé en direct pendant le zoom.

## Résolution

```ts
dpiEffectif(emplacement, photo): number
// largeur de la zone visible en pixels de l'original / largeur du cadre en mm × 25,4
niveauResolution(dpi): "bon" | "moyen" | "faible"   // ≥ 300 · 150 à 300 · < 150
```

- Le cadre retenu est celui de la géométrie, sans fond perdu.
- Le zoom fait baisser le DPI : zoomer deux fois divise la largeur de zone par deux.
- Badge sur le cadre : rien pour « bon », surlignage beurre pour « moyen », rose et « Qualité insuffisante pour l'impression » pour « faible ». Jamais bloquant (RG-16).

## États de l'écran

| État | Affichage |
|---|---|
| Chargement | Squelette de la double page et de la bande |
| Livre sans double page intérieure | Message, « + » et « Composer le livre » |
| Cadres vides | Pointillé lavande, « Déposer une photo » |
| Réserve vide | Message et « Importer des photos » |
| Toutes les photos posées | Réserve affichée à 45 %, une photo peut resservir (RG-15) |
| Enregistrement | Statut dans l'en-tête : Enregistré · Enregistrement… · Non enregistré · Réessayer |
| Hors-ligne | Bandeau persistant, gestes désactivés |
| Session expirée | Renvoi vers la connexion avec l'adresse demandée (mécanisme existant) |

## Erreurs

| Cas | Conduite |
|---|---|
| Écriture d'emplacement refusée ou réseau coupé | Retour arrière, « Non enregistré · Réessayer » |
| Photo supprimée dans un autre onglet | Écriture refusée par la clé étrangère ; retour arrière et message « Cette photo n'est plus dans le livre. » ; les doubles pages sont relues |
| Double page supprimée dans un autre onglet | `introuvable` ; les doubles pages sont relues, la page courante est recalculée |
| Gabarit par défaut introuvable (catalogue vide) | « + » désactivé |
| Rpc de structure refusée | Message dans un bandeau ; les doubles pages sont relues |

## Tests

- **pgTAP, `inserer_double_page`** : gabarit d'une autre famille refusé ; gabarit de la famille accepté (le cas existant).
- **Vitest, `cadrage.ts`** : `dpiEffectif` à zoom 1 et 2, photo plus petite que le cadre, cadre à cheval sur le pli ; `niveauResolution` aux trois seuils et à leurs bornes.
- **Vitest, `etatEditeur.ts`** : chaque action ; `retablir` remet l'emplacement à l'identique ; poser écrit le cadrage neutre ; vider garde le cadrage.
- **Vitest, `fileEcritures.ts`** : ordre conservé ; statut à chaque étape ; échec suivi d'un retour arrière ; rejeu.
- **Vitest, `gabaritParDefaut.ts`** : les trois familles du catalogue ; égalité départagée ; catalogue vide.
- **Vitest, `DoublePage.tsx`** : sélection, cadre vide, badge de résolution, rendu sans interaction inchangé.
- **Playwright, `e2e/editeur.spec.ts`** : importer trois photos, composer ; poser une photo par glisser-déposer puis au clavier ; recadrer ; vider ; ajouter, dupliquer, déplacer et supprimer une double page ; recharger la page : tout est conservé.

## Hors de 6a

Changement de gabarit (6b) ; saisie des textes, polices, thèmes (6c) ; couverture et 4e (6d) ; toast « Annuler » et pile d'annulation (6e) ; glisser une photo d'un cadre vers un autre ; glisser au doigt.

## Pour la documentation

Dans ce lot, avec accord :

- `docs/architecture.md` et `docs/modele-donnees.md`, règles garanties par les fonctions : `inserer_double_page` vérifie la famille du gabarit.
- `docs/design-system.md`, écart #3 : tranché, pas de poignées, de flèches ±1 mm ni de « Pivoter ».

À la fin du lot, sur demande : statuts des étapes 41, 43 et 44 dans le suivi Notion.
