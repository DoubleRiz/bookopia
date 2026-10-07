# Moteur de gabarits

Lot L5 · Moteur de gabarits. Étapes 36 (catalogue de gabarits), 37 (rendu d'écran des gabarits), 38 (moteur de génération). L'étape 39 (nombre pair de doubles pages) est abandonnée, l'étape 40 (thèmes) sort du lot. Écran : E7 Éditeur, affichage des doubles pages.

## Objectif

Après l'import, le Créateur clique « Composer le livre » : les pages intérieures sont remplacées par une maquette adaptée à ses photos, chaque photo posée dans un cadre à son orientation. Il voit le livre à l'écran, double page par double page, exactement comme le PDF le rendra.

## Décisions

| Sujet | Décision | Coût assumé |
|---|---|---|
| Déclenchement | Bouton « Composer le livre » sur E7 | Un geste de plus que l'automatique, mais le livre ne change jamais sans qu'on le demande |
| Livre déjà commencé | Les intérieures sont remplacées, après confirmation si une photo y est posée | Le travail fait dans les intérieures est perdu ; la modale le dit |
| Règle du moteur | Au nombre et à l'orientation : la suite de gabarits de la famille qui pose toutes les photos en recadrant le moins | Le moteur ignore le contenu des images et l'écart entre les dates : un panoramique peut réunir deux journées |
| Où vit le moteur | Fonction pure de `packages/shared`, appelée par le navigateur ; `composer_livre` vérifie et écrit | La règle de choix n'est pas en SQL : la base vérifie le résultat, elle ne le calcule pas |
| Écriture | `composer_livre` supprime les intérieures et les recrée d'un coup | Les identifiants des intérieures changent à chaque composition ; rien ne les référence de l'extérieur |
| `remplir_emplacements` | Supprimée, avec ses tests et son bouton | Annoncé en L2 : « une fonction que L5 reprendra ou remplacera » |
| Rendu d'écran | SVG en millimètres ; le `viewBox` d'un emplacement est la zone renvoyée par `zoneVisible` | La saisie de texte dans un SVG est malcommode : un champ HTML superposé en L6 |
| Image à l'écran | La vignette, dans le repère de l'original (`largeur_px` × `hauteur_px`) | Moins nette qu'un original, mais légère |
| Fond de la double page | Couleur de fond du thème, comme le PDF | Seul élément du thème appliqué en L5 |
| Couverture et 4e | Géométrie actuelle déclarée définitive ; jamais touchées par la composition | Une seule couverture et une seule 4e par famille |
| Cadres texte | Laissés vides par le moteur | Remplis dans l'éditeur (L6) |
| Nombre pair de doubles pages (étape 39) | Abandonné : la RG-19 (reliure par cahiers) est retirée des spécifications fonctionnelles | Un imprimeur à la demande complète lui-même avec des pages blanches |
| Thèmes (étape 40) | Hors du lot | Polices et `fontkit` en L6 et L7 |

## Découpage

**`packages/shared`**

| Fichier | Rôle |
|---|---|
| `composition.ts` | `composerLivre(photos, gabarits)` : le moteur, pur |
| `cadrage.ts` | Gagne `placerPhoto(emplacement, photo)`, utilisée par le PDF et par l'écran |
| `rendu-pdf.ts` | `dessinerPhoto` appelle `placerPhoto` au lieu de refaire le calcul |

**`supabase/migrations/`** : `composer_livre`, commentée en français ; `drop function remplir_emplacements`. **`supabase/tests/`** : `composer_livre_test.sql` ; `remplir_emplacements_test.sql` supprimé. **`supabase/seed.sql`** : le mot « provisoire » retiré des couvertures et 4e, coordonnées inchangées.

**`apps/web/src/api/doublesPages.ts`** : lire les doubles pages d'un livre et leurs emplacements, dans l'ordre du livre ; appeler `composer_livre`.

**`apps/web/src/composants/DoublePage.tsx`** : le rendu SVG d'une double page.

**Écran** : `LivreEnCours.tsx` (`/livre/:id`) affiche les doubles pages et gagne le bouton « Composer le livre » ; le bouton « Remplir les emplacements » disparaît.

## Le moteur

```ts
composerLivre(
  photos: { id: string; largeur_px: number; hauteur_px: number; prise_le: string | null; cree_le: string }[],
  gabarits: { id: string; definition: DefinitionGabarit }[], // intérieurs actifs de la famille du livre
): { gabarit_id: string; poses: { indice: number; photo_id: string }[] }[]
```

1. **Ordre des photos** : par `prise_le` ; les photos sans date ensuite, par `cree_le` ; `id` départage. Deux compositions des mêmes photos donnent le même livre.
2. **Coût d'une photo dans un cadre** : la part de l'image perdue au recadrage, `1 − min(rp / rc, rc / rp)`, avec `rp = largeur_px / hauteur_px` et `rc = largeur / hauteur` du cadre. Une photo 4:3 dans un cadre 4:3 coûte 0 ; une photo portrait 3:4 dans le panoramique 3:1 coûte 0,75.
3. **Une double page** : un gabarit à k cadres photo reçoit k photos consécutives. Toutes les répartitions des k photos sur les k cadres sont essayées (k ≤ 6, soit 720 au plus), la moins coûteuse est gardée.
4. **Le livre** : programmation dynamique sur le rang de la première photo non posée et le gabarit de la double page précédente. Elle trouve la suite de gabarits qui pose toutes les photos, dans l'ordre, au coût total le plus bas.
5. **Coût total** : somme des coûts de recadrage, plus `PENALITE_REPETITION` quand deux doubles pages consécutives ont le même gabarit, plus `PENALITE_CADRE_VIDE` par cadre photo laissé vide.
6. **Reste** : seule la dernière double page peut avoir des cadres photo vides, quand aucune suite ne tombe juste (une photo dans la famille « Rythmé », dont le plus petit gabarit a deux cadres).
7. **Égalités** : départagées par le nom du gabarit, pour rester déterministe.
8. **Cadres texte** : ignorés, ils restent vides.
9. **Aucune photo ou aucun gabarit** : liste vide.

Les deux pénalités sont des constantes nommées et commentées, réglées par les tests. `PENALITE_CADRE_VIDE` dépasse le pire coût de recadrage d'une double page entière : un cadre vide n'est jamais préféré à un recadrage.

`choisirGabaritsInterieurs` reste : elle sert à la création du livre, quand il n'y a pas encore de photo.

## La fonction `composer_livre`

```sql
composer_livre(p_projet_id uuid, p_doubles_pages jsonb) returns integer
-- p_doubles_pages : [{ "gabarit_id": uuid, "poses": [{ "indice": int, "photo_id": uuid }] }, …]
-- renvoie le nombre d'intérieures créées
```

`security definer`, comme les autres fonctions appelables, et dans une seule transaction :

1. `verrouiller_projet(p_projet_id)` : lève `introuvable` si le livre n'est pas au Créateur, et fait passer un double clic après le premier.
2. Vérifications, chacune levant `invalide` avec un détail en français :
   - au moins une double page ;
   - le livre a un modèle d'origine (sa famille fait foi) ;
   - chaque gabarit est actif, de rôle `interieur` et de la famille du modèle d'origine ;
   - chaque `indice` existe dans son gabarit, désigne un cadre `photo`, et n'apparaît qu'une fois dans sa double page ;
   - chaque photo appartient au projet.
3. Suppression des intérieures ; leurs emplacements partent en cascade. Couverture et 4e intactes.
4. Recréation des intérieures aux rangs 1 à N par `creer_double_page`, puis pose de chaque photo avec un cadrage neutre (`0,5 / 0,5 / 1`).
5. Renvoie N.

## Le rendu d'écran

`placerPhoto(emplacement, photo) → { cadre, zone }` : `cadre` est le cadre prolongé du fond perdu (`prolongerParFondPerdu`), `zone` le rectangle de l'image qui le remplit (`zoneVisible`). Le PDF et l'écran l'appellent tous les deux.

```tsx
<svg viewBox="0 0 420 210" overflow="hidden" role="img" aria-label="Pages 6 et 7">
  <rect width="420" height="210" fill={fondDuTheme} />
  {/* emplacement photo posé */}
  <svg x={cadre.x} y={cadre.y} width={cadre.largeur} height={cadre.hauteur}
       viewBox={`${zone.x} ${zone.y} ${zone.largeur} ${zone.hauteur}`} preserveAspectRatio="none">
    <image href={vignette} width={largeur_px} height={hauteur_px} preserveAspectRatio="none" />
  </svg>
  {/* emplacement photo vide : rectangle pointillé lavande ; emplacement texte : pointillé gris clair */}
  <line x1="210" y1="0" x2="210" y2="210" /> {/* pli, discret */}
</svg>
```

- Le repère d'un emplacement est celui de l'original : la vignette y est étirée, `zone` s'applique telle quelle.
- Le fond perdu dépasse de 3 mm du `viewBox` extérieur et se trouve masqué, comme à la coupe.
- Libellés : « Couverture », « Pages 2 et 3 » pour l'intérieure 1 (l'intérieure n porte les pages 2n et 2n + 1), « Quatrième de couverture ».

## Interface

Sur `/livre/:id`, les doubles pages s'empilent sur le plan de travail lavande, dans l'ordre du livre. La réserve et l'export restent en place.

| Élément | Contenu |
|---|---|
| **Composer le livre** | Désactivé si la réserve est vide |
| Intérieures sans photo posée | Composition immédiate |
| Au moins une photo posée dans une intérieure | Modale « Recomposer le livre ? » : « Les pages intérieures seront recomposées. Les photos déjà posées retournent dans la réserve. » Focus sur Annuler. |
| En cours | Bouton désactivé, « Composition… » |
| Réussi | Le loader repasse, les doubles pages s'affichent |
| Échec | Message dans la modale, ou dans un bandeau si aucune modale n'est ouverte |
| Livre sans double page intérieure | Couverture et 4e affichées, invitation à composer |

L'action lit les gabarits intérieurs actifs de la famille du livre, valide leur `definition` par Zod, appelle `composerLivre`, puis `composer_livre`.

## Erreurs

| Cas | Conduite |
|---|---|
| Gabarit mal formé dans le catalogue | Zod le rejette avant tout appel ; message, rien n'est écrit |
| Livre d'un autre, ou supprimé entre-temps | `introuvable`, « Ce livre n'existe plus. » |
| Gabarit retiré du catalogue entre la lecture et l'écriture | `invalide`, « Le catalogue a changé, recomposez le livre. » |
| Photo supprimée dans un autre onglet | `invalide`, même message |
| Session expirée | Renvoi vers la connexion avec l'adresse demandée |

La composition réussit en entier ou n'écrit rien.

## Tests

- **Vitest, `composition.ts`** : ordre et départage des photos ; coût d'un cadre ; meilleure répartition dans une double page ; partition exacte du nombre de photos ; reste avec cadres vides sur la dernière double page seulement ; pénalité de répétition ; photos portrait orientées vers des cadres portrait ; déterminisme ; liste vide.
- **Vitest, `cadrage.ts`** : `placerPhoto` sur un cadre au bord et un cadre intérieur. **`rendu-pdf.ts`** : les tests existants passent sans changement.
- **pgTAP, `composer_livre`** : cas nominal (rangs 1 à N, photos posées, cadrage neutre) ; couverture et 4e intactes, photos de la couverture conservées ; livre d'un autre ; gabarit d'une autre famille, de rôle couverture, inactif ; cadre texte visé, indice inconnu, indice en double ; photo d'un autre projet ; liste vide ; livre sans modèle d'origine.
- **Playwright** : `premier-pdf.spec.ts` passe de « Remplir les emplacements » à « Composer le livre » ; un parcours importe des photos, compose, vérifie que les doubles pages affichent des images, recompose après confirmation.

## Pour la documentation

Dans ce lot, avec accord :

- `docs/architecture.md`, tableau des fonctions : `composer_livre`.
- `docs/modele-donnees.md`, règles garanties par les fonctions : « Les intérieures sont remplacées d'un coup, par des gabarits actifs de la famille du modèle, photos du projet posées dans des cadres photo » → `composer_livre`.

À la fin du lot, sur demande : statuts des étapes 36 à 40 dans le suivi Notion.
