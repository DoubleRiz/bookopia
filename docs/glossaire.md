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
| **Couverture** | La première et la quatrième de couverture du projet |
| **Double page** | L'unité d'édition : une planche de deux pages en vis-à-vis. On n'édite jamais une page seule. |
| **Emplacement** | Une zone d'image à l'intérieur d'une double page. Sa géométrie vient du gabarit, copiée à la création. |
| **Réserve** | Toutes les photos importées d'un projet, posées ou non |
| **Posée** | Se dit d'une photo référencée par au moins un emplacement. Calculé, jamais stocké. |
| **Photo** | Une image importée, avec ses métadonnées d'analyse (netteté, exposition, dHash) |

## Modèles

| Terme | Sens |
|---|---|
| **Gabarit** | Modèle de disposition d'une double page : combien d'emplacements, où, de quelle taille. Sa géométrie est **copiée** dans les emplacements à la pose. |
| **Modèle de livre** | Livre préconfiguré proposé à la création. Ses valeurs sont **copiées** dans le projet : modifier le modèle ensuite n'affecte aucun projet existant. |
| **Thème** | Habillage visuel (couleurs, typographies). Il est **référencé**, pas copié : une amélioration du thème bénéficie aux projets existants. |

## Traitements

| Terme | Sens |
|---|---|
| **Import** | L'ajout de photos à la réserve, suivi de leur analyse par le worker |
| **Curation** | Le bilan présenté une fois après l'import, qui propose d'écarter des photos. Écarter = suppression définitive de la ligne et du fichier ; il n'existe pas d'action inverse. |
| **Préflight** | Les contrôles effectués avant le rendu : DPI insuffisant, emplacements vides. Ce sont des avertissements, jamais des blocages. |
| **Export** | Une demande de rendu PDF et son résultat |
| **Job** | Une tâche déposée en file d'attente pour le worker. Un job par photo à l'ingestion, un job par projet pour la similarité et pour le rendu. |

## Interface

| Terme | Sens |
|---|---|
| **Écran** | Une vue principale de l'application, numérotée E0 à E10 dans les spécifications fonctionnelles |
| **Surcouche** | Un écran affiché en superposition d'un autre : popup, panneau modal |
| **État transversal** | Un état d'affichage commun à plusieurs écrans : chargement, vide, erreur, hors ligne… |

