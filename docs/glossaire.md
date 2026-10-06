# Glossaire métier

Ces termes ont un sens précis. Ils s'utilisent tels quels dans le code, la documentation, l'interface et les échanges. Ne pas les traduire, ne pas introduire de synonyme.

## Personnes

| Terme | Sens |
|---|---|
| **Créateur** | Utilisateur connecté, propriétaire de ses projets |
| **Visiteur** | Utilisateur anonyme, non connecté |

## Objets du livre

| Terme | Sens |
|---|---|
| **Projet** | Un livre photo en cours de création. L'objet racine : tout lui appartient. |
| **Couverture** | La première de couverture : une double page de rôle `couverture`, créée avec le projet |
| **Quatrième** | La quatrième de couverture : une double page de rôle `quatrieme`, créée avec le projet |
| **Double page** | L'unité d'édition : une planche de deux pages en vis-à-vis. On n'édite jamais une page seule. |
| **Emplacement** | Une zone d'image à l'intérieur d'une double page. Sa géométrie vient du gabarit, copiée à la création. |
| **Réserve** | Toutes les photos importées d'un projet, posées ou non |
| **Posée** | Se dit d'une photo référencée par au moins un emplacement. Calculé, jamais stocké. |
| **Photo** | Une image importée, décrite par son fichier : dimensions, date de prise de vue, empreinte |
| **Brouillon** | Intention posée par le Créateur sur son projet, réversible. Ce n'est pas un avancement : vide, exporté… se calculent. |

## Modèles

| Terme | Sens |
|---|---|
| **Gabarit** | Modèle de disposition d'une double page : combien d'emplacements, où, de quelle taille. Il a un rôle (couverture, intérieur, quatrième) et appartient à une famille. Sa géométrie est **copiée** dans les emplacements à la pose. |
| **Famille** | Groupe de gabarits d'un même esprit, dans lequel le moteur de gabarits choisit |
| **Modèle de livre** | Livre préconfiguré proposé à la création. Ses valeurs sont **copiées** dans le projet : modifier le modèle ensuite n'affecte aucun projet existant. |
| **Thème** | Habillage visuel (couleurs, typographies). Il est **référencé**, pas copié : une amélioration du thème bénéficie aux projets existants. |

## Traitements

| Terme | Sens |
|---|---|
| **Import** | L'ajout de photos à la réserve. Chaque photo est traitée par l'API pendant l'envoi : vignette, date de prise de vue, rejet des doublons stricts. |
| **Préflight** | Les contrôles effectués avant le rendu : DPI insuffisant, emplacements vides. Ce sont des avertissements, jamais des blocages. |
| **Export** | Une demande de rendu PDF, son état et son résultat. La ligne sert aussi de file au worker. |
| **Job** | Un rendu PDF pris en charge par le worker : un job par export. |

## Interface

| Terme | Sens |
|---|---|
| **Écran** | Une vue principale de l'application, numérotée E0 à E10 dans les spécifications fonctionnelles |
| **Surcouche** | Un écran affiché en superposition d'un autre : popup, panneau modal |
| **État transversal** | Un état d'affichage commun à plusieurs écrans : chargement, vide, erreur, hors ligne… |

