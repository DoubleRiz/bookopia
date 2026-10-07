# Textes et thèmes

Lot L6 · Éditeur, troisième sous-lot (6c). Étapes 40 (thèmes appliqués par-dessus la géométrie) et 45 (légendes : limite, mesure fontkit, mêmes polices des deux côtés). Écran : E7 Éditeur, surcouche non adressée « Choix du thème ».

## Objectif

Le Créateur écrit dans les cadres texte, directement dans le cadre, et choisit le thème de son livre. L'écran et le PDF dessinent le texte avec les mêmes polices et les mêmes coupures de ligne. **Aucun texte ne déborde de son cadre dans le PDF.**

## Décisions

| Sujet | Décision | Coût assumé |
|---|---|---|
| Choix du thème | Dans l'éditeur, par `changer_theme`, comme l'annoncent les maquettes | Une surcouche et une fonction de plus |
| Titre ou légende | Le cadre texte du gabarit porte un `style`, copié dans `emplacement.style_texte` comme la nature et la géométrie | Une migration, le seed à compléter. Écartés : relire le gabarit au rendu (`gabarit_origine_id` n'est qu'informatif), déduire de la hauteur (règle implicite) |
| Styles | `titre`, `titre_page`, `legende`. `titre_page` : le titre du gabarit 10, seul texte visible en Silence. Le paragraphe du gabarit 9 est une `legende` | Un style de plus que de polices : `titre_page` prend la typographie `titre` |
| Typographie du thème | `police_titre` et `police_texte` remplacées par `typographie jsonb`, validée par Zod | Le JSON n'est pas validé en base, comme `definition` : un thème mal formé échoue au chargement |
| Débordement | Mise en lignes partagée : une fonction pure coupe le texte avec les largeurs réelles des glyphes (fontkit). La saisie refuse ce qui ferait déborder | Le navigateur a le dernier mot sur la règle fine : la base ne sait pas mesurer une police. Elle garde un plafond de 400 caractères |
| Changement de thème | Peut faire déborder un texte qui tenait (Caveat 15 pt contre Nunito 9 pt). Le PDF coupe la dernière ligne visible par « … », l'éditeur signale le cadre, le choix du thème prévient | Un texte peut être tronqué à l'impression si le Créateur ignore l'avertissement |
| Saisie | Dans le cadre : une zone de texte HTML posée sur le dessin, à la police du thème et à l'échelle (`cqw`) | Pendant la frappe, le navigateur peut couper une ligne autrement que le PDF. Hors saisie, le cadre affiche les lignes de la mise en lignes partagée |
| Polices | Sept fichiers TTF statiques, sous-ensemble latin, licence OFL, dans le dépôt. Les mêmes octets servent à l'écran (`FontFace`), à la mesure et au PDF | Quelques centaines de Ko téléchargés par l'éditeur. Instances produites une fois avec `fonttools` en poste local, pas une dépendance |
| Dépendance | `@pdf-lib/fontkit` dans `packages/shared`, validée | Seule façon d'intégrer EB Garamond et Caveat avec pdf-lib |
| Couverture et 4e | Leurs cadres reçoivent un style dans le seed ; elles sont rendues dans le PDF avec le thème. Leur saisie est en 6d | Le titre du livre en couverture sous Silence est tranché en 6d |

## Thèmes

`theme.typographie` :

```json
{
  "titre":   { "police": "EB Garamond", "graisse": 500, "italique": false, "taille_pt": 18 },
  "legende": { "police": "EB Garamond", "graisse": 400, "italique": true,  "taille_pt": 10 },
  "alignement": "centre",
  "ancrage": "haut",
  "styles_masques": []
}
```

| Thème | Titre | Légende | `alignement` | `ancrage` | `styles_masques` | Filet (`bordure_cadre.filet_pt`) |
|---|---|---|---|---|---|---|
| Classique | EB Garamond 500 · 18 pt | EB Garamond 400 italique · 10 pt | `centre` | `haut` | `[]` | — |
| Moderne | Nunito 800 · 18 pt | Nunito 400 · 9 pt | `gauche` | `haut` | `[]` | — |
| Carnet | Nunito 700 · 15 pt | Caveat 600 · 15 pt | `exterieur` | `bas` | `[]` | 0,5 |
| Silence | Nunito 600 · 14 pt | Nunito 400 · 9 pt | `centre` | `haut` | `["titre", "legende"]` | — |

Silence affiche le seul `titre_page`, conformément au design system § 15. Sa typographie de légende n'est jamais dessinée ; elle existe pour que le schéma reste uniforme.

La couleur du texte est `palette.texte`, déjà présente. `rayon_angles` et `marge_interieure` ne changent pas (0 partout).

## Découpage

**`supabase/migrations/`** : migration `textes_et_themes`.

- Énuméré `style_texte` : `titre`, `titre_page`, `legende`.
- `emplacement.style_texte`, contrainte `emplacement_style_selon_nature` : renseigné si et seulement si `nature = 'texte'`. Les emplacements texte existants passent à `legende`.
- Contrainte `emplacement_plafond_texte` : `char_length(contenu_texte) <= 400`.
- `theme` : `typographie jsonb not null`, `police_titre` et `police_texte` supprimées.
- `copier_geometrie` copie `style` ; un cadre texte sans style fait échouer la création sur la contrainte.
- `dupliquer_double_page` copie `style_texte`.
- `changer_theme(p_projet_id, p_theme_id)`, appelée par `rpc`.

**`supabase/seed.sql`** : `typographie` des quatre thèmes ; `style` de chaque cadre texte.

| Gabarit | Cadres texte |
|---|---|
| 08 Panoramique et légende | T1 `titre`, T2 `legende` |
| 09 Photo et bloc texte | T1 `titre`, T2 `legende` |
| 10 Page de titre | T1 `titre_page` |
| 11 Trio et légendes | T1 à T3 `legende` |
| Couvertures | T1 `titre`, T2 `legende` |
| Quatrièmes | T1 `legende` |

**`packages/shared/src/`** :

| Fichier | Rôle |
|---|---|
| `gabarit.ts` | `cadreSchema` gagne `style`, obligatoire pour un cadre texte, absent pour un cadre photo |
| `typographie.ts` | Nouveau. Schéma Zod de `typographie`, interligne (1,2 × la taille), conversion point → mm, typographie d'un style |
| `polices.ts` | Nouveau. Catalogue des sept fichiers, clé d'un fichier depuis `{police, graisse, italique}`, `creerMesure(octets)` avec fontkit |
| `mise-en-lignes.ts` | Nouveau. `mettreEnLignes`, `disposerTexte`, `tronquerPourTenir` |
| `rendu-pdf.ts` | Polices intégrées, texte dessiné, filet, troncature |
| `index.ts` | Exporte les nouveautés |

**`apps/web/src/polices/`** : les sept TTF, `OFL.txt`, un `README.md` avec la commande `fonttools` qui les a produits.

**`apps/web/src/`** :

| Fichier | Rôle |
|---|---|
| `api/themes.ts` | Nouveau. `listerThemes` (actifs, typographie validée), `changerTheme` |
| `api/photos.ts` | `lireProjet` lit `theme (id, nom, palette, bordure_cadre, typographie)` |
| `api/doublesPages.ts` | `listerDoublesPages` lit `style_texte` ; `ecrireEmplacement` accepte `contenu_texte` |
| `api/exports.ts` | `lireLivreARendre` lit le thème complet, `style_texte` et `contenu_texte` |
| `export/charger.ts` | Charge les polices du thème et les passe au rendu |
| `editeur/polices.ts` | Nouveau. Télécharge un fichier une fois, l'enregistre auprès de `document.fonts` (`FontFace`) et en tire la mesure |
| `composants/DoublePage.tsx` | Dessine les lignes de `disposerTexte` ; cadre masqué, cadre qui déborde ; cible des cadres texte |
| `editeur/SaisieTexte.tsx` | Nouveau. La zone de texte posée sur le cadre |
| `editeur/SurcoucheThemes.tsx` | Nouveau. Choix du thème |
| `editeur/etatEditeur.ts` | Action `ecrireTexte` |
| `editeur/Editeur.tsx` | Sélection d'un cadre texte, saisie, écriture différée, bouton « Thème » |
| `ecrans/LivreEnCours.tsx` | Le loader lit les thèmes et charge les polices du thème courant |

## `changer_theme`

```sql
changer_theme(p_projet_id uuid, p_theme_id uuid) returns void
-- security definer
```

1. Projet d'un autre ou inexistant : `introuvable`.
2. Thème inexistant ou inactif : `invalide`, détail en français.
3. `projet.theme_id` est mis à jour. Rien d'autre : le thème ne touche ni la géométrie ni les textes.

## Mise en lignes

Toutes les mesures en millimètres, dans le repère du gabarit. La mesure est fournie par l'appelant : `{ largeur(texte, taille_mm), ascendant }` (ascendant en fraction de la taille). `packages/shared` reste pur, sans réseau.

**`mettreEnLignes(texte, largeurMax, taille_mm, mesure) → string[]`**

- Les retours à la ligne du Créateur sont respectés.
- Coupure gloutonne aux espaces ; un mot plus large que le cadre est coupé caractère par caractère.
- Les espaces en fin de ligne ne comptent pas dans la largeur.

**`disposerTexte(emplacement, typographie, mesure) → TexteDispose`**

```ts
type TexteDispose = {
  masque: boolean;          // style dans styles_masques
  deborde: boolean;         // lignes × interligne > hauteur
  police: ClePolice;
  taille_mm: number;
  ancre: "debut" | "milieu" | "fin";
  lignes: { texte: string; x: number; y: number }[]; // y : ligne de base
};
```

- `alignement` : `gauche` → début au bord gauche ; `centre` → milieu ; `exterieur` → début si le centre du cadre est sur la page de gauche (x < 210), fin au bord droit sinon.
- `ancrage` : `haut` → première ligne de base à `ascendant × taille` sous le haut du cadre ; `bas` → le bloc de lignes repose sur le bas du cadre.
- Un texte vide ou nul donne zéro ligne.
- Les lignes rendues sont toutes les lignes ; c'est l'appelant qui décide de tronquer.

**`tronquerPourTenir(emplacement, typographie, mesure) → lignes`** : les lignes qui tiennent dans la hauteur, la dernière terminée par « … » (raccourcie jusqu'à ce que « … » tienne dans la largeur). Utilisée par le PDF, et par l'écran pour un cadre qui déborde.

**`prefixeQuiTient(texte, …) → string`** : le plus long début du texte qui ne déborde pas (recherche dichotomique). Sert au collage.

## Le PDF

- `LivreARendre` gagne `theme` (`texte`, `typographie`, `filet_pt`) et `polices` (octets par clé). `EmplacementARendre` gagne `style_texte` et `contenu_texte`.
- fontkit enregistré ; seules les polices utilisées par un texte visible sont intégrées, en sous-ensemble.
- Chaque cadre texte non masqué et non vide : lignes de `tronquerPourTenir`, `drawText` aux positions données, ancre convertie en décalage avec la largeur mesurée, couleur `palette.texte`.
- Carnet : filet de `filet_pt` sur le bord haut de chaque cadre texte visible et non vide.
- Un cadre texte vide n'est pas dessiné (pas de gris comme pour une photo).

## L'éditeur

**Polices.** Le loader de `LivreEnCours` attend les polices du thème courant : un fichier par clé, téléchargé une fois pour la session, enregistré par `FontFace` sous un nom propre (« Livre Caveat »…) pour ne pas se mêler à la Nunito de l'interface. Les polices des autres thèmes se chargent à l'ouverture du choix du thème. Une police illisible : bandeau d'erreur, la saisie est désactivée, le reste de l'éditeur fonctionne.

**Affichage d'un cadre texte** (`DoublePage`, éditeur et miniatures) :

- Texte : un `<text>` SVG par ligne, police et taille du thème, `text-anchor` selon l'ancre.
- Cadre vide : le pointillé actuel ; dans l'éditeur, « Écrire un titre » ou « Écrire une légende » en texte secondaire.
- Cadre masqué : pointillé, « Masqué par le thème » ; il n'est pas modifiable, le texte reste en base.
- Cadre qui déborde : lignes de `tronquerPourTenir`, surlignage et pastille fortes comme la résolution, « Texte coupé à l'impression ».

**Saisie dans le cadre** (`SaisieTexte`) :

- Un cadre texte est une cible comme un cadre photo : clic ou Entrée le sélectionne ; clic sur un cadre sélectionné, Entrée ou double clic ouvre la saisie.
- La zone de texte HTML est posée sur le cadre en pourcentages, comme les pastilles. `.dessin` est un conteneur (`container-type: inline-size`) : la taille de police vaut `taille_mm / 420 × 100 cqw`, l'interligne 1,2, l'alignement celui du thème, sans marge ni bord. En ancrage bas, sa hauteur est celle des lignes et elle repose sur le bas du cadre.
- Pendant la saisie, le SVG ne dessine pas ce cadre ; un contour de sélection reste visible.
- À chaque frappe, `disposerTexte` sur la nouvelle valeur : si elle déborde et qu'elle est plus longue que l'ancienne, elle est refusée et « Le cadre est plein » s'annonce (`aria-live`). Une valeur plus courte est toujours acceptée, même si elle déborde encore : le Créateur peut réparer un texte coupé par un changement de thème.
- Collage : seul `prefixeQuiTient` est inséré ; « Le texte collé a été raccourci » s'annonce.
- `maxLength` 400, comme la base.
- Entrée insère un retour à la ligne. Échap, Tab ou un clic ailleurs terminent la saisie.

**Écriture.** Chaque frappe met à jour l'état (`ecrireTexte`). L'écriture en base part par la file d'écriture 600 ms après la dernière frappe, et tout de suite à la fin de la saisie : `update emplacement set contenu_texte`, chaîne vide écrite `null`. Si la base refuse, le texte revient à la dernière valeur enregistrée et le statut passe à « Non enregistré · Réessayer », comme pour une photo.

**Choix du thème** (`SurcoucheThemes`) :

- Bouton « Thème · Classique » parmi les actions du livre. Désactivé hors-ligne et pendant une écriture de structure.
- `Modale` « Changer le thème ». Une carte par thème actif, dans l'ordre du catalogue : la double page courante dessinée avec ce thème, son nom. Le thème actuel porte « Actuel ». Clavier comme le choix du gabarit, cartes d'au moins 44 px.
- Sous une carte, ce que le thème fera au livre, calculé sur toutes les doubles pages : « 3 textes seront masqués », « 2 textes seront coupés ». Rien si rien ne change.
- Choisir une carte applique le thème, sans confirmation : rien n'est perdu, le geste se défait en choisissant l'ancien thème.
- Écriture : les écritures d'emplacement en attente sont terminées, rpc `changer_theme`, puis le loader repasse (`revalidate`). Refus : bandeau, le thème affiché ne change pas.

## Erreurs

| Cas | Conduite |
|---|---|
| Thème désactivé entre-temps | `invalide` : « Ce thème n'est plus proposé. » ; les thèmes sont relus |
| Texte de plus de 400 caractères (contournement du front) | La contrainte refuse ; texte rétabli, statut « Non enregistré » |
| Police introuvable ou illisible | Bandeau dans l'éditeur, saisie désactivée ; l'export échoue avec un message, jamais de PDF avec une police de substitution |
| `typographie` mal formée | Échec au parse du loader, comme un gabarit mal formé |

## Tests

- **pgTAP** : `style_texte` copié à la création, au changement de gabarit et à la duplication ; cadre texte sans style refusé ; cadre photo avec style refusé ; plafond de 400 caractères ; `changer_theme` : projet d'un autre `introuvable`, thème inactif `invalide`, cas nominal ; `typographie` présente pour chaque thème du seed.
- **Vitest, `mise-en-lignes.ts`**, mesure factice à chasse fixe : coupure aux espaces, retours à la ligne, mot trop long, texte vide ; trois alignements, `exterieur` des deux côtés du pli, deux ancrages, style masqué, débordement ; `tronquerPourTenir` et « … » ; `prefixeQuiTient`.
- **Vitest, polices réelles** : chaque fichier du catalogue se lit ; une légende qui tient en Moderne déborde en Carnet.
- **Vitest, `rendu-pdf.ts`** : polices intégrées seulement si utilisées ; texte masqué non dessiné ; texte trop long tronqué ; filet en Carnet seulement.
- **Vitest, `gabarit.ts`** : cadre texte sans style refusé, cadre photo avec style refusé.
- **Vitest, `DoublePage`**, rendu statique : lignes d'un texte, cadre masqué, cadre qui déborde.
- **Playwright, `e2e/editeur.spec.ts`** : sur une double page du gabarit 11, écrire une légende, recharger, la retrouver ; taper au-delà du cadre, le texte s'arrête ; changer de thème vers Silence : la légende est masquée, le titre de la page de titre reste ; revenir à Classique : la légende réapparaît ; exporter : le PDF contient le texte de la légende.

## Hors de 6c

Saisie de la couverture et de la 4e (6d) ; annuler une saisie ou un changement de thème (6e) ; liste des textes coupés dans les contrôles avant export (L7) ; césure ; mise en forme dans un texte (gras, italique) ; taille de police au choix.

## Pour la documentation

Dans ce lot, avec accord :

- `docs/modele-donnees.md` : `emplacement.style_texte`, `theme.typographie` à la place de `police_titre` et `police_texte`, `changer_theme`, plafond de 400 caractères.
- `docs/architecture.md` : la mise en lignes partagée, la mesure dans le navigateur, le plafond en base ; `theme` et `projet.theme_id` modifiable par `changer_theme`.
- `docs/design-system.md` § 15 : les styles `titre`, `titre_page`, `legende`.

À la fin du lot, sur demande : statut des étapes 40 et 45 dans le suivi Notion.
