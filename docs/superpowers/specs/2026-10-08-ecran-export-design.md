# Écran d'export

Lot L7 · Export prêt impression. Étapes 49 (contrôle des 300 DPI par emplacement photo) et 50 (écran d'export : progression, téléchargement, version précédente). Écran : E9 Export, `/livre/:id/export`. Règles : RG-16, RG-20, RG-21, RG-22.

L'étape 48 (renderer complet) est terminée. L'étape 31 (SSE) est annulée : le rendu est local. L'étape 51 (paragraphe RVB du dossier) relève de la documentation et reste hors de ce spec.

## Objectif

Avant de lancer le rendu, le Créateur voit les cadres photo trop pauvres en pixels et les cadres photo restés vides, avec un lien vers chacun. Rien ne bloque l'export. Il suit la progression page par page, télécharge le PDF, et garde l'ancien tant que le nouveau n'est pas prêt.

## Décisions

| Sujet | Décision | Coût assumé |
|---|---|---|
| Où se calculent les contrôles | Fonction pure `controlerExport` dans `packages/shared`, à côté de `dpiEffectif` et `niveauResolution` | Une lecture de plus pour E9 (doubles pages, cadres, dimensions des photos). Écartés : fonction SQL (recopierait la géométrie de `placerPhoto`, deux implémentations à garder identiques), calcul dans le composant (non testable, non réutilisable) |
| Ce que la liste contient | Cadres photo sous 150 DPI et cadres photo vides. Les cadres entre 150 et 300 DPI ne sont pas listés | Un cadre à 200 DPI passe sans mention à l'export, il garde son avertissement doux dans l'éditeur (RG-16). Un cadre texte vide n'est jamais signalé : l'absence de texte est un choix valable |
| Bloquant ou non | Rien ne bloque : le bouton d'export reste actif quelle que soit la liste | Le Créateur peut imprimer un PDF flou ou troué en connaissance de cause (RG-16) |
| Seuil | `niveauResolution(dpi) === "faible"`, donc strictement sous 150 | Aucune constante nouvelle : le seuil reste défini en un seul endroit |
| Adresse | Route `/livre/:id/export`, rechargeable, avec son propre loader | Un loader de plus. Le bloc provisoire `ExportDuLivre` quitte `LivreEnCours`, qui garde un lien « Exporter » |
| Liens de la liste | Chaque entrée mène à `/livre/:id?page=<double_page_id>`, adresse que l'éditeur sait déjà lire | Le lien ouvre la double page, pas le cadre : sélectionner le cadre demanderait un second paramètre, non demandé |
| États de l'écran | Dérivés de l'état de la page, rien n'est stocké | Un export en cours ne survit pas à un rechargement : le rendu vit dans l'onglet, comme aujourd'hui |

## Contrôles

```ts
type ControleExport = {
  faibles: { double_page_id: string; emplacement_id: string; dpi: number }[];
  vides: { double_page_id: string; emplacement_id: string }[];
};

controlerExport(doublesPages): ControleExport
```

- Entrée : les doubles pages dans l'ordre du livre (couverture, intérieures, 4e), chacune avec ses emplacements, leur nature, leur cadrage et la photo posée (`largeur_px`, `hauteur_px`).
- Un emplacement `photo` sans photo est **vide**.
- Un emplacement `photo` avec photo est **faible** quand `niveauResolution(dpiEffectif(emplacement, photo)) === "faible"`. Le DPI tient compte du cadrage et du zoom, comme l'avertissement de l'éditeur.
- Un emplacement `texte` n'est jamais listé.
- Les listes suivent l'ordre du livre, puis l'indice de l'emplacement. Le DPI est conservé non arrondi, l'écran l'arrondit.

## Écran E9

Lecture au chargement : le titre du livre, les doubles pages avec leurs emplacements et leurs photos, la ligne `export` et l'adresse signée du PDF (une heure, comme aujourd'hui). Pour la couverture et la 4e, le lien mène à la page de l'éditeur de leur `double_page_id`, comme les autres.

| État | Quand | Ce que le Créateur voit |
|---|---|---|
| Demandé | Aucun export n'existe, rien en cours | Contrôles, bouton « Exporter le PDF » |
| En cours | Un rendu tourne, sans ancien PDF | Progression : « Téléchargement des photos n sur N », puis « Composition du PDF », puis « Enregistrement ». Bouton inactif |
| En cours, version précédente disponible | Un rendu tourne, un ancien PDF existe | Même progression, et le lien « Télécharger le PDF » de l'ancienne version reste actif (RG-21, RG-22) |
| Réussi et disponible | Le rendu a abouti, ou un export existe | Lien de téléchargement, mention « à jour » ou « modifié depuis » (`export.cree_le` contre `projet.modifie_le`), bouton « Exporter à nouveau » |
| Échec | Le rendu ou le dépôt a échoué | Bannière avec le message, l'ancien PDF reste téléchargeable s'il existe, bouton pour réessayer |

Les messages d'échec restent ceux de `ExportDuLivre` (PDF de plus de 50 Mo, réseau, autre). Session expirée : retour à la connexion en gardant l'adresse, comme aujourd'hui. Fermer l'onglet en plein rendu demande confirmation (`beforeunload`), comportement conservé.

Après un export réussi, le loader est relu : les contrôles se recalculent, l'adresse signée du nouveau PDF est lue.

## Déroulé de l'export

Inchangé : `exporter` (`apps/web/src/export/exporter.ts`) charge les originaux, compose, dépose le PDF sous une clé neuve, enregistre la ligne, puis supprime l'ancien fichier. L'écran ne fait que l'appeler avec ses étapes.

## Découpage

1. **`packages/shared`** : `controlerExport` et ses tests (cadre faible, vide, texte ignoré, zoom qui fait baisser le DPI, ordre du livre).
2. **`apps/web`** : lecture des doubles pages pour E9 dans `api/` ; loader et route `/livre/:id/export` ; écran `Export` avec les contrôles, les cinq états et les liens ; retrait de `ExportDuLivre` de `LivreEnCours` au profit d'un lien « Exporter ».
3. **Tests** : composants (les cinq états, `exporter` simulé, liste vide, liens), et extension de `e2e/premier-pdf.spec.ts` : un cadre vide et un cadre sous 150 DPI listés, export, téléchargement, lien vers la double page.

## Hors périmètre

- Le paragraphe RVB du dossier (étape 51).
- Une liste des cadres entre 150 et 300 DPI.
- La sélection du cadre dans l'éditeur à l'arrivée par un lien.
- Tout suivi d'un rendu qui survivrait à un rechargement.
