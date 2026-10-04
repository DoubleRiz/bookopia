# Design system

**Lavande & pastels** — fond blanc, lavande en couleur principale, quatre pastels pour colorer les sections, un accent corail pour l'étincelle. Contrastes conformes WCAG 2.2 AA.

Ce document est la transcription de [`maquettes/Bookopia design system.dc.html`](../maquettes/Bookopia%20design%20system.dc.html) (v1.0), qui reste la référence visuelle. Les écarts entre ce design system et les décisions prises depuis sont listés en fin de document.

## 1 · Couleurs

### Neutres

| Rôle | Valeur |
|---|---|
| Fond | `#FFFFFF` |
| Encre · texte | `#1E1B2E` |
| Texte corps | `#3E3856` |
| Texte secondaire | `#5E5873` |
| Bordure | `#CDBCEB` |

### Principale · lavande

| Rôle | Valeur | Usage |
|---|---|---|
| Lavande pâle | `#F4EFFC` | Chrome, survols légers |
| Lavande | `#E2D5F8` | Cartes, panneaux, filets |
| Lavande soutenu · CTA | `#7B52B8` | Actions, liens, sélection |
| CTA survol | `#6A43A5` | Survol, pressé |

### Pastels · pâle / moyen / encre

| Pastel | Valeurs | Usage |
|---|---|---|
| Rose poudré | `#FDEEF3` · `#FBD9E4` · `#8A2847` | Émotion, famille, cadeaux |
| Menthe | `#EAF8F1` · `#CDEFE0` · `#1F5E45` | Réassurance, succès |
| Bleu ciel | `#EAF1FF` · `#C8DCFF` · `#2F4A80` | Survol, information, voyage |
| Beurre | `#FFF5E6` · `#FFE7C2` · `#7A4A0E` | Attente, alertes douces |

### Accent · corail

| Rôle | Valeur | Usage |
|---|---|---|
| Corail | `#F2637E` | Pictos, pastilles, points |
| Corail encre | `#D43F5E` | Mot mis en valeur dans un titre |

**Règles d'usage, strictes :** jamais sur un bouton ni en texte courant. Texte posé sur corail : encre `#1E1B2E` uniquement (5,4:1). **Une touche par écran, deux au maximum.**

### Couleurs fonctionnelles

| Rôle | Valeur |
|---|---|
| Bouton destructif | `#C4334F`, survol `#A82B44` |
| Texte d'erreur de champ | `#B0304F` |
| Voile de modale | encre à 42 % · `rgba(30,27,46,.42)` |

### Contrastes de référence

| Couple | Ratio |
|---|---|
| Encre / fond | 17,1 · AAA |
| Secondaire / fond | 6,7 · AA |
| Encre / lavande | 12,0 · AAA |
| Blanc / CTA | 5,6 · AA |
| Encre / corail | 5,4 · AA |
| Corail encre / fond | 4,6 · AA |

---

## 2 · Typographie

Une seule famille : **Nunito**, terminaisons arrondies.

- **Titres** et noms de livres : graisse 800, approche serrée (`letter-spacing: -.015em`). Mots mis en valeur en corail, **jamais en italique**.
- **Interface** (texte, boutons, badges, champs) : graisses 400 / 600 / 700.

| Niveau | Taille / interligne | Exemple d'usage |
|---|---|---|
| Display | 48 / 1.05 | Accroche d'accueil |
| H1 | 36 / 1.1 | Titre d'écran |
| H2 | 26 / 1.2 | Titre de section |
| H3 | 19 / 1.25 | Titre de carte |
| Corps | 15 / 1.6 | Texte courant |
| Petit | 13 / 1.5 | Métadonnées |
| Label | 11, capitales | Étapes, étiquettes |

---

## 3 · Formes et espacements

**Rayons** — `4` : pages et photos · `10` : champs · `20` : cartes · `pill` (`999px`) : boutons et badges.

**Espacements**, base 4 : `4 · 8 · 12 · 16 · 24 · 32 · 48`.

**Élévation** — quatre niveaux, teintés encre, **jamais noirs**. Plus c'est haut, plus c'est temporaire.

| Niveau | Ombre | Usage |
|---|---|---|
| 1 · contact | `0 1px 3px rgba(30,27,46,.12)` | Badges sur photo, miniatures, onglet actif |
| 2 · page | `0 8px 24px rgba(30,27,46,.12)` | Pages du livre, tirages, barre d'outils |
| 3 · flottant | `0 10px 40px rgba(30,27,46,.18)` | Toasts, barre de sélection, menus |
| 4 · modale | `0 24px 64px rgba(30,27,46,.28)` | Modales uniquement, avec voile |

---

## 4 · Motifs et formes

### Formes géométriques

| Forme | Usage |
|---|---|
| Page | Unité de base, rayon 4. Vignettes, photos. |
| Double page | Pli central. Aperçus de gabarit. |
| Arche | Cadre signature. Modèles, onboarding. |
| Cercle | Avatars, étapes, pastille corail. |
| Quart et demi-disque | Motifs de coin, sections pastel. |
| Pile de pages | Plusieurs livres, chargement. |

**Règle :** une forme décorative par bloc au maximum, en pastel moyen sur pastel pâle, **jamais sous du texte**.

### Trames pointillées

| Variante | Usage |
|---|---|
| Fondu linéaire · lavande | Bandeaux d'en-tête, haut de section |
| Fondu rapide · corail | Accent ponctuel, coin de carte promo |
| Fondu centré · bleu ciel | Fond d'illustration, onboarding |
| Filet · menthe | Séparateur décoratif, 5 rangs |

- **Grille** : pas de 6 px, points de 2,3 px de rayon à 0,35 d'opacité. Toujours horizontale, dense à droite.
- **Couleur** : encre du pastel sur son fond pâle, ou corail sur rose. Une trame par écran.
- **Texte** : jamais sur la partie dense, seulement sur le côté clair.

---

## 5 · Boutons

| Niveau | Défaut | Survol |
|---|---|---|
| Principal | fond `#7B52B8`, texte blanc, 700 | fond `#6A43A5` |
| Secondaire | fond blanc, contour 1 px `#CDBCEB`, texte encre, 600 | fond et contour `#C8DCFF` |
| Tertiaire | texte seul, encre ou `#7B52B8`, 600 | fond `#F4EFFC` |
| Destructif | fond `#C4334F`, texte blanc, 700 | fond `#A82B44` |

- **Focus** : anneau `0 0 0 2px #FFFFFF, 0 0 0 4px #7B52B8`.
- **Désactivé** : fond `#E2D5F8`, texte `#5E5873`.

| Taille | Hauteur | Police | Padding |
|---|---|---|---|
| Grand | 52 | 700 · 16 | 15 × 28 |
| Moyen | 44 | 700 · 14 | 12 × 22 |
| Petit | 32 | 700 · 12 | 8 × 14 |
| Icône | 44 × 44, rond | 600 · 20 | — style secondaire |

---

## 6 · Badges et états

### Tonalités

Sept tonalités couvrent tous les états. **Pastille de couleur + libellé : jamais la couleur seule.** Badge : pill, 700 · 12, pastille de 7 px.

| Tonalité | Fond | Texte | Pastille | Sens |
|---|---|---|---|---|
| Neutre | `#F4EFFC` | `#1E1B2E` | `#A9A3BC` | Attente d'une action, état par défaut |
| En cours | `#EAF1FF` | `#2F4A80` | `#4F78D6` | Traitement système, l'utilisateur patiente |
| Attention | `#FFF5E6` | `#7A4A0E` | `#E39B2D` | Suggestion ou réserve, non bloquant |
| Succès | `#EAF8F1` | `#1F5E45` | `#2E9E6E` | Validé, prêt |
| Erreur | `#FDEEF3` | `#8A2847` | `#D43F5E` | Échec ou blocage, action requise |
| Inactif | `#FFFFFF` + contour `#E2D5F8` | `#5E5873` | `#CDBCEB` | Hors-jeu : écarté, expiré, déjà utilisé |
| Final | `#1E1B2E` | `#FFFFFF` | `#CDEFE0` | Étape terminale du livre |

**Sur les vignettes** : mini-badge 10 px, fond opaque, coin bas-gauche. Écartée = vignette à 45 %.

### États des objets

| Objet | État | Tonalité |
|---|---|---|
| Photo — import | En traitement (`en_attente`) | en cours |
| | Prête (`prete`) — aucun libellé, la vignette s'affiche normalement | — |
| | Échec (`echec`) | erreur |
| Photo — curation | Non arbitrée | neutre |
| | Suggérée — floue / surexposée / similaire | attention |
| | Gardée | succès |
| | À écarter — choix, pas une erreur : vignette atténuée, réversible | inactif |
| Photo — réserve | Disponible — se lit sans badge, le libellé sert aux filtres | neutre |
| | Déjà posée | inactif |
| | En traitement | en cours |
| Export | Demandé | neutre |
| | Rendu en cours | en cours |
| | Rendu en cours · version précédente disponible | en cours |
| | Prêt à télécharger | succès |
| | Expiré | inactif |
| | Échec du rendu | erreur |
| Livre — état stocké | Brouillon | neutre |
| | Terminé | final |
| Livre — avancement calculé | Vide | inactif |
| | Import en cours | en cours |
| | Curation à faire | attention |
| | En composition | neutre |
| | Prêt à exporter | succès |
| | Exporté | final |

« En traitement » est l'affichage de l'attente, pas un quatrième état. L'avancement calculé s'affiche sur la carte du livre (E4) **à la place** de l'état stocké.

### Avertissements de résolution

| Seuil | Traitement |
|---|---|
| 150–300 DPI | Cadre surligné beurre — « Un cadre plus petit serait préférable » |
| < 150 DPI | Cadre surligné rose — « Qualité insuffisante pour l'impression ». Avertissement fort, listé avant l'export, **n'empêche pas le rendu** |
| < 1000 px côté long | « Photo de petite taille », sur la vignette en réserve |

### Fichiers refusés et motifs d'échec

Ce qui ne passe pas est arrêté **à la sélection**, avant tout envoi. Ce qui échoue après l'envoi se réimporte : le fichier est resté sur le disque du Créateur.

| Cas | Traitement |
|---|---|
| JPEG, PNG, WebP | Seuls formats acceptés |
| HEIC, RAW | Refusés à la sélection |
| Plus de 10 Mo | Refusé à la sélection |
| Moins de 1000 px côté long | Avertissement, pas un refus |

Motifs d'échec, au nombre de trois : `format_non_supporte`, `fichier_corrompu`, `erreur_technique`.

Pas de bouton « réessayer » sur un échec d'import : un réessai serveur n'aurait rien à traiter, le geste proposé est de réimporter. La résolution n'est jamais un échec, seulement un avertissement.

### Composants d'état

Cinq composants : **bannière** dans la page, **état vide**, **progression**, **toast**, **squelette**.

| État transversal | Composant |
|---|---|
| Chargement | Squelette |
| Vide | État vide |
| Nominal | — |
| Erreur de chargement | Bannière + Réessayer |
| Hors-ligne | Bannière fixe |
| Session expirée | Modale de reconnexion |

### États d'écran

| Écran | État | Composant |
|---|---|---|
| E5 — Import | Vide | État vide · zone de dépôt |
| | Sélection en attente de validation | Barre d'action |
| | Fichiers refusés à la sélection | Bannière + liste |
| | Envoi en cours (n sur N) | Progression |
| | Traitement en cours | Progression + vignettes |
| | Terminé sans échec | Toast |
| | Terminé avec échecs | Bannière + détail |
| | Import interrompu | Bannière + Reprendre |
| | Doublons rejetés | Bannière |
| | Attente du sélecteur Google | Voile + message |
| E6 — Bilan de curation | Aucune photo | État vide → E5 |
| | Aucune suggestion | État vide positif |
| | Suggestions à arbitrer | Compteur + filtres |
| | Tout arbitré, prêt à valider | Bannière + Valider |
| E7 — Éditeur | Livre sans double page | État vide · Ajouter |
| | Emplacements vides | Cadre pointillé |
| | Réserve épuisée | État vide réserve |
| | Avertissement de résolution | Badge sur cadre |
| | Photos en traitement, non posables | Vignette verrouillée |
| E9 — Export | Demandé | Badge |
| | En cours | Progression |
| | Réussi et disponible | Bannière + Télécharger |
| | Expiré | Badge + Relancer |
| | Échec | Bannière + Relancer |

---

## 7 · Champs et sélection

- **Champ** : 400 · 15, padding 12 × 14, contour 1 px `#CDBCEB`, rayon 10. Libellé au-dessus, 600 · 13.
- **Focus** : contour `#7B52B8` + halo `0 0 0 3px #E2D5F8`.
- **Erreur** : contour `#D43F5E` + halo `0 0 0 3px #FDEEF3`, message sous le champ en `#B0304F`, 12 px.

**Tuiles sélectionnables** (rayon 10) :

| État | Fond | Contour |
|---|---|---|
| Par défaut | `#FFFFFF` | 1 px `#E2D5F8` |
| Survol | `#EAF1FF` | 1 px `#C8DCFF` |
| Sélectionné | `#F4EFFC` | 2 px `#7B52B8` + coche ronde lavande soutenu |

**Onglets** : conteneur pill `#F4EFFC`, padding 4. Onglet actif : fond blanc, élévation 1, 700 · 13. Inactifs : 600 · 13, `#5E5873`.

**Barre de progression simple** : 8 px, pill, fond `#F4EFFC`, remplissage `#7B52B8`.

---

## 8 · Cartes

Rayon 20. Visuel de 160 px de haut en tête, contenu en padding 16 × 18.

| Carte | Visuel | Contenu |
|---|---|---|
| Modèle | Fond = pastel moyen de la catégorie | Titre H3 + flèche, description, badge format. Survol : remonte de 4 px. |
| Livre du Créateur | Fond lavande pâle, aperçu de double page | Titre H3 + badge d'état, métadonnées, actions Reprendre (principal petit) et Dupliquer (secondaire petit) |
| Info | Fond pastel pâle, pas de visuel | Pastille ronde 52 px pastel moyen, titre H3, texte en `#3E3856` |

---

## 9 · Parcours

Quatre étapes toujours visibles en haut de l'espace de création : **Importer · Trier · Composer · Exporter**. Les étapes passées restent cliquables ; les suivantes ne s'ouvrent qu'une fois l'étape en cours validée.

| État | Rendu |
|---|---|
| En cours | Pastille lavande soutenu, libellé en gras, fond lavande pâle |
| Terminé | Coche menthe, liaison menthe. Cliquable pour revenir. |
| À venir | Numéro gris, non cliquable. Jamais masqué. |

---

## 10 · Tri des photos

- **Vignette** : rayon 4, comme une page. Sélection = anneau lavande 3 px + coche ; la case n'apparaît qu'au survol. Écartée : vignette à 45 %.
- **Filtres** : pills avec compteur. Filtre actif en encre plein. Le compteur se met à jour en direct.
- **Progression du tri automatique** : titre, message (« Recherche des doublons et des photos floues »), compteur n sur N, temps restant estimé.
- **Sélection multiple** : barre flottante en bas d'écran (élévation 3), visible dès une sélection : compteur, Annuler, Écarter, Garder. Action principale à droite.

---

## 11 · Éditeur

- **Plan de travail** lavande pâle, double page blanche en élévation 2.
- **Emplacement sélectionné** : contour 2 px + 4 poignées rondes ; barre d'outils flottante au-dessus (Recadrer, Remplacer, Pivoter, Supprimer).
- **Emplacement vide** : pointillé lavande, « Déposer une photo ».
- **Navigateur de doubles pages** : bande en bas de l'éditeur. Double page active : anneau lavande. Glisser pour réordonner. Bouton `+` en fin de bande.
- **Réserve** : photos gardées au tri, à glisser dans les emplacements. Une photo posée reste visible à 45 %.

---

## 12 · Retours système

| Niveau | Composant | Usage | Position |
|---|---|---|---|
| 1 | Statut | Discret, permanent. Enregistrement, hors-ligne. | En-tête |
| 2 | Toast | Confirme une action. Annulable. | Bas-centre |
| 3 | Bannière | Concerne la page. Reste jusqu'à résolution. | Haut de contenu |
| 4 | Modale | Bloque, demande un choix. Destructif, irréversible. | Centre |

### Toasts

Encre sur fond sombre, toujours : fond `#1E1B2E`, texte blanc, rayon 12, élévation 3. La tonalité est portée par une pastille de 8 px seule (pastel moyen). Une action au plus, en lavande clair `#E2D5F8`. Durée 4 s, 8 s si annulable. Un seul toast à la fois ; le suivant remplace.

Après une action destructive, le toast propose **Annuler**.

### Modales

Titre en question, conséquence en clair, verbe d'action sur le bouton. **Rose réservé à l'irréversible** (bouton destructif). Voile encre 42 %, rayon 20, largeur max 420 px. Échap et clic sur le voile = Annuler.

| Type | Exemple |
|---|---|
| Confirmation destructive | « Supprimer « Été à Lisbonne » ? » — Annuler / **Supprimer** (destructif) |
| Décision | « Remplacer le gabarit ? » — Garder l'actuel / **Remplacer** (principal) |

### Chargement

| Indicateur | Règle |
|---|---|
| Dans un bouton | Dans le bouton qui a lancé l'action, libellé conservé. Tour de 0,8 s. |
| Progression hachurée | Hauteur 12 px. Hachures lavande qui défilent tant que ça travaille ; à 100 %, aplat menthe sans hachure. |
| Squelette | Reprend la forme exacte du contenu. Lueur lente de gauche à droite, 1,4 s. |
| Chargement signature · tirage photo | Attentes longues et plein écran : import, analyse, export. Trois cartes aux pastels du contenu, cycle de 3 s, celle du dessus passe sous la pile. Trois points lavande de 8 px qui respirent en vague (1,2 s, décalage 0,18 s). Message court, sans « … » : les points font la suspension. |

### Statut d'enregistrement

Dans l'en-tête de l'éditeur, à droite du titre :

- Enregistré
- Enregistrement…
- Hors-ligne · enregistré sur cet appareil
- Non enregistré · Réessayer

Pas de bouton Enregistrer : la sauvegarde est automatique. Le statut ne clignote pas et ne déclenche pas de toast.

---

## 13 · Accessibilité

Cible **WCAG 2.2 AA**. Les pastels sont des fonds : le texte posé dessus est toujours l'encre de sa famille.

| Couple | Ratio |
|---|---|
| Texte courant | 16,8:1 |
| Texte secondaire | 6,7:1 |
| Secondaire sur lavande pâle | 6,0:1 |
| Lien, bouton tertiaire | 5,6:1 |
| Bouton principal | 5,6:1 |
| Bouton destructif | 5,3:1 |
| En cours | 7,7:1 |
| Succès | 7,0:1 |
| Avertissement | 6,9:1 |
| Erreur | 7,6:1 |
| Encre sur pastel moyen | 12,1:1 |
| Corail | 3,1:1 — grand texte uniquement |

AA : texte de toute taille. Grand texte : 18 px gras minimum. Décor seul : pastilles, motifs, jamais de texte.

**Focus clavier** : anneau unique, 2 px blanc + 2 px lavande soutenu. Visible au clavier uniquement (`:focus-visible`). Même anneau partout ; les champs gardent leur bordure lavande + halo. Sur un emplacement déjà sélectionné, un halo lavande pâle s'ajoute.

**Raccourcis de l'éditeur** — tout ce qui se fait au glisser-déposer se fait aussi au clavier.

| Touche | Action |
|---|---|
| Tab | Passer à l'emplacement ou à la double page suivante |
| ← → ↑ ↓ | Déplacer l'emplacement de 1 mm (Maj : 10 mm) |
| Entrée | Entrer dans l'emplacement : recadrer, remplacer |
| Suppr | Vider l'emplacement sélectionné |
| Ctrl Z | Annuler |
| Échap | Sortir de l'emplacement, fermer la modale |

**Cibles tactiles** : 44 px minimum. Un filtre de 36 px ou une poignée de 10 px ont une zone cliquable étendue à 44 px, sans changer le visuel. 8 px minimum entre deux cibles.

**Règles générales**

- **Jamais la couleur seule** : un état = pastille + libellé ; sélection = anneau + coche.
- **Mouvement réduit** : si l'utilisateur le demande, toutes les animations s'arrêtent ; les tirages restent empilés.
- **Annonces** : toasts, statut d'enregistrement et progression annoncés aux lecteurs d'écran, sans voler le focus.
- **Photos** : chaque photo porte un texte alternatif, lieu et date par défaut, modifiable.
- **Modales** : focus piégé dans la modale, rendu à l'élément d'origine à la fermeture.
- **Zoom** : page lisible à 200 % sans défilement horizontal, hors plan de travail de l'éditeur.

---

## 14 · Gabarits

Source du fichier de gabarits. Unités en **millimètres**. Origine en haut à gauche de la double page, fonds perdus exclus.

### Format de référence — identique pour tout le livre

| Mesure | Valeur |
|---|---|
| Page | 210 × 210 |
| Double page | 420 × 210 — page gauche X 0 → 210, page droite X 210 → 420 |
| Pli | X 210 |
| Fonds perdus | 3, sur les 4 bords extérieurs |
| Marge · zone utile photo | 12 · X 12–200 / 220–408 |
| Gouttière | 10 + 10 · X 200–220 |
| Sécurité texte | 15 · X 15–195 / 225–405 |

Un emplacement photo posé sur un bord extérieur (X = 0, Y = 0, X + L = 420, Y + H = 210) est prolongé de 3 mm dans les fonds perdus à l'export. Les coordonnées restent celles de la page finie.

### Règles

1. **Le pli ne se traverse que dans les gabarits 1 et 8.** Partout ailleurs, la gouttière (X 200–220) reste vide : aucun emplacement, photo ou texte, n'y entre.
2. **Six emplacements photo au maximum par gabarit.** Au-delà, les photos sont trop petites pour l'impression. La mosaïque six (n° 7) est la limite.

Notation : photo `P1, P2…`, texte `T1, T2…`.

### Famille « Généreux » · 1–3

Une ou deux photos, à fond perdu sur les bords extérieurs.

| N° | Nom | Emplacement | Type | X | Y | L | H | Ratio |
|---|---|---|---|---|---|---|---|---|
| 01 | Pleine double page — traverse le pli | P1 | Photo | 0 | 0 | 420 | 210 | 2,000 · 2:1 |
| 02 | Pleine page + blanc — page droite vide | P1 | Photo | 0 | 0 | 200 | 210 | 0,952 |
| 03 | Deux pleines pages | P1 | Photo | 0 | 0 | 200 | 210 | 0,952 |
| | | P2 | Photo | 220 | 0 | 200 | 210 | 0,952 |

### Famille « Rythmé » · 4–7

Deux à six photos, posées dans la zone utile (marges 12 mm).

| N° | Nom | Emplacement | Type | X | Y | L | H | Ratio |
|---|---|---|---|---|---|---|---|---|
| 04 | Duo horizontal | P1 | Photo | 12 | 34,5 | 188 | 141 | 1,333 · 4:3 |
| | | P2 | Photo | 220 | 34,5 | 188 | 141 | 1,333 · 4:3 |
| 05 | Trio — une grande à gauche, deux empilées à droite | P1 | Photo | 12 | 12 | 188 | 186 | 1,011 |
| | | P2 | Photo | 220 | 12 | 188 | 88 | 2,136 |
| | | P3 | Photo | 220 | 110 | 188 | 88 | 2,136 |
| 06 | Quatuor — grille 2 × 2 centrée sur le pli | P1 | Photo | 84 | 13 | 116 | 87 | 1,333 · 4:3 |
| | | P2 | Photo | 220 | 13 | 116 | 87 | 1,333 · 4:3 |
| | | P3 | Photo | 84 | 110 | 116 | 87 | 1,333 · 4:3 |
| | | P4 | Photo | 220 | 110 | 116 | 87 | 1,333 · 4:3 |
| 07 | Mosaïque six — grille 3 × 2, une colonne par page | P1 | Photo | 113 | 12 | 87 | 58 | 1,500 · 3:2 |
| | | P2 | Photo | 220 | 12 | 87 | 58 | 1,500 · 3:2 |
| | | P3 | Photo | 113 | 76 | 87 | 58 | 1,500 · 3:2 |
| | | P4 | Photo | 220 | 76 | 87 | 58 | 1,500 · 3:2 |
| | | P5 | Photo | 113 | 140 | 87 | 58 | 1,500 · 3:2 |
| | | P6 | Photo | 220 | 140 | 87 | 58 | 1,500 · 3:2 |

### Famille « Raconté » · 8–11

Photos et emplacements texte. Tout texte reste dans la zone de sécurité.

| N° | Nom | Emplacement | Type | X | Y | L | H | Ratio |
|---|---|---|---|---|---|---|---|---|
| 08 | Panoramique + légende — traverse le pli | P1 | Photo | 0 | 0 | 420 | 140 | 3,000 · 3:1 |
| | | T1 | Texte · titre | 15 | 155 | 180 | 40 | — |
| | | T2 | Texte · légende | 225 | 155 | 180 | 40 | — |
| 09 | Photo + bloc texte | P1 | Photo | 12 | 12 | 188 | 186 | 1,011 |
| | | T1 | Texte · titre | 240 | 66 | 150 | 22 | — |
| | | T2 | Texte · paragraphe | 240 | 96 | 150 | 48 | — |
| 10 | Page de titre — titre centré, photo en vignette | P1 | Photo | 270 | 48 | 90 | 90 | 1,000 · 1:1 |
| | | T1 | Texte · titre | 240 | 150 | 150 | 24 | — |
| 11 | Trio + légendes | P1 | Photo | 14 | 30 | 186 | 124 | 1,500 · 3:2 |
| | | P2 | Photo | 220 | 30 | 89 | 124 | 0,718 |
| | | P3 | Photo | 319 | 30 | 89 | 124 | 0,718 |
| | | T1 | Texte · légende | 15 | 162 | 180 | 14 | — |
| | | T2 | Texte · légende | 225 | 162 | 79 | 14 | — |
| | | T3 | Texte · légende | 319 | 162 | 81 | 14 | — |

---

## 15 · Thèmes

Un thème définit la typographie des titres et des légendes, la couleur du texte, la position de la légende dans son emplacement, le filet et le fond de page.

**Un thème ne change jamais la géométrie des emplacements.** Seul le contenu des emplacements texte se déplace à l'intérieur de l'emplacement.

| Thème | Police titre | Police légende | Couleur du texte | Position de la légende | Filet | Fond |
|---|---|---|---|---|---|---|
| Classique | EB Garamond 500 · 18 pt | EB Garamond italique · 10 pt | `#3E3856` | Centrée, haut de l'emplacement | Non | Blanc cassé `#FAF7F2` |
| Moderne | Nunito 800 · 18 pt | Nunito 400 · 9 pt | `#1E1B2E` | À gauche, haut de l'emplacement | Non | Lavande pâle `#F4EFFC` |
| Carnet | Nunito 700 · 15 pt | Caveat 600 · 15 pt | `#2F4A80` | Bas de l'emplacement, calée bord extérieur | Oui · 0,5 pt, haut des emplacements texte | Beurre pâle `#FFF5E6` |
| Silence | Nunito 600 · 14 pt · page de titre seule | — masquée | `#1E1B2E` | Aucune | Non | Blanc pur `#FFFFFF` |

**Silence** : aucun texte visible, sauf le titre de la page de titre (gabarit n° 10).

---

## 16 · En situation

Le HTML reprend la page d'accueil (E0) pour montrer le système appliqué. La version qui fait foi est celle de [`maquettes/Bookopia maquettes.dc.html`](../maquettes/Bookopia%20maquettes.dc.html).

---

## Écarts à trancher

Le design system v1.0 a été produit avant plusieurs décisions. Points en conflit, à corriger lors de la prochaine passe :

1. **Curation réversible.** Le design system décrit « à écarter » comme un choix réversible jusqu'à la validation du bilan (tonalité `inactif`, vignette atténuée, toast « Annuler », carte info « vous pouvez changer d'avis »). Le modèle de données retient **une seule action, suppression immédiate et définitive**. À réfléchir.
2. **Format unique.** La section 16 du HTML propose « Portrait A4 », « Livre libre · format au choix » et « Le format se change encore après ». Le format est unique (21 × 21) ; la maquette E0 est à jour.
3. **Pas de canvas libre.** Les raccourcis (déplacer de 1 mm / 10 mm), les poignées et l'outil Pivoter supposent une géométrie modifiable et une rotation. La géométrie est copiée du gabarit et `cadrage` ne porte pas de rotation.
4. **Bibliothèque.** La modale de suppression indique « Vos photos restent dans votre bibliothèque ». Les photos appartiennent au projet et sont supprimées avec lui.
5. **Tutoiement.** « Convertis en JPEG depuis ton téléphone » ; le reste de l'interface vouvoie.
