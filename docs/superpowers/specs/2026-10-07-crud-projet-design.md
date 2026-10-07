# CRUD projet : créer, renommer, supprimer

Étape L1 · Socle technique. Écrans : E4 Mes livres, S1 Créer un livre.

## Objectif

Le Créateur crée un livre depuis un modèle, le renomme et le supprime, depuis l'écran « Mes livres ».

## Décisions

| Sujet | Décision | Coût assumé |
|---|---|---|
| Gabarits intérieurs | Une fonction pure `choisirGabaritsInterieurs` dans `packages/shared` fait tourner les gabarits intérieurs actifs de la famille du modèle. Le moteur de gabarits la remplacera. | Mise en page mécanique des premiers livres |
| Fichiers d'un livre supprimé | Le front supprime la ligne, puis les fichiers du projet dans `photos` et `exports`. Même règle que pour une photo. | Une interruption laisse au pire des fichiers inutiles |
| Renommer | Modale, ouverte depuis la ligne du livre | Un composant `Modale`, partagé avec la suppression |
| Après la création | Retour sur E4, le livre en tête. L'import (E5) n'existe pas encore. | Un clic de plus quand E5 existera, à revoir alors |
| Aperçus de modèle | Tuile de couleur : aucun visuel n'existe pour `cle_apercu` | Aucun |
| Filtres du catalogue | Absents : la base ne porte pas de catégorie de modèle | Aucun |

## Routes

| Adresse | Loader | Action |
|---|---|---|
| `/livres` | Liste des projets | `intention` = `renommer` ou `supprimer` |
| `/livres/nouveau` (enfant de `/livres`) | Modèles actifs, gabarits intérieurs actifs | Crée le livre, puis redirige vers `/livres` |

Les deux passent par `sousSession` : une session expirée renvoie à la connexion avec l'adresse demandée.

## Flux

**Créer.**

1. Zod valide l'entrée : `titre` facultatif, `modele_livre_id` obligatoire.
2. Un titre vide devient « Livre sans titre ».
3. `choisirGabaritsInterieurs(gabarits, modele)` : filtre `role = 'interieur'` et `famille = modele.famille`, trie par nom, répète la liste jusqu'à `nombre_doubles_pages_depart`.
4. `rpc('creer_projet', { p_titre, p_modele_livre_id, p_gabarits_interieurs_ids })`. La fonction revérifie tout.

**Renommer.** `update({ titre })` sur `projet`, protégé par la RLS. Même schéma Zod que la création, titre obligatoire. La base refuse déjà un titre vide (`check`). Pas de longueur maximale, ni en base ni au front.

**Supprimer.**

1. `delete()` sur `projet` : la cascade supprime doubles pages, emplacements, photos, export.
2. Liste puis suppression des fichiers sous `photos/{utilisateur_id}/{projet_id}/originaux/`, `…/vignettes/` et `exports/{utilisateur_id}/{projet_id}/`. La règle Storage le permet : elle vérifie le premier dossier.

**Erreurs.** Réseau coupé, `invalide` ou `introuvable` : message dans la surcouche ou la modale. Le reste remonte à l'élément d'erreur de la route.

## Interface

**Composants nouveaux** (`apps/web/src/composants/`)

- `Modale` : sur `<dialog>` et `showModal()`. Voile encre 42 %, rayon 20, largeur maximale 420 px, une variante large pour S1. Échap et clic sur le voile valent Annuler. Le focus revient au déclencheur.
- `CatalogueModeles` : grille de tuiles (couleur, nom, « N doubles pages »), choix unique par bouton radio. Il ne connaît pas S1 : il servira sur E0.

**E4 Mes livres**

- Bouton principal « Nouveau livre » dans l'en-tête, vers `/livres/nouveau`.
- Sur chaque ligne, deux boutons secondaires petits : Renommer, Supprimer.
- État vide : « Aucun livre pour l'instant », bouton « Créer mon premier livre ».

**S1 Créer un livre**

- « Nouveau livre », sous-titre « Le modèle est copié dans le livre, pas lié à lui. »
- Catalogue, premier modèle présélectionné.
- Champ « Titre du livre », aide « Facultatif · renommable partout ».
- « Ce qui sera copié » : nom du thème, nombre de doubles pages.
- Annuler (retour à `/livres`) · **Créer le livre**, désactivé pendant l'envoi.
- Chargement : squelette de la grille.

**Modale Renommer.** « Renommer le livre », champ prérempli et sélectionné, Annuler · **Renommer**, erreur sous le champ.

**Modale Supprimer.** « Supprimer « X » ? », « Ses doubles pages, ses photos et ses exports sont supprimés. Cette action est définitive. », Annuler · **Supprimer** en rose. Pas de toast : rien à annuler.

## Tests

| Niveau | Contenu |
|---|---|
| Vitest | `choisirGabaritsInterieurs` : nombre, rôle, famille, rotation, ordre stable, liste vide si aucun gabarit ne convient. Écrit avant la fonction. |
| pgTAP | Rien de nouveau : `creer_projet`, la RLS de `projet` et Storage sont couverts. Relancés. |
| Playwright | Un parcours : compte de test, créer depuis S1, retrouver en tête de E4, renommer, supprimer. Nouveaux `playwright.config.ts`, `e2e/` et script `npm run e2e`, hors de `npm test`. Supposent `supabase start`. |
| Manuel | Déposer un fichier dans le dossier d'un projet depuis Studio, supprimer le livre, vérifier que le fichier a disparu. |

## Hors périmètre

Dupliquer, marquer brouillon ou terminé, statut d'avancement calculé, import, éditeur, vitrine E0.
