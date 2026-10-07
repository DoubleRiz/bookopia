# Changement de gabarit

Lot L6 · Éditeur, deuxième sous-lot (6b). Étape 42 (changer le gabarit d'une double page). Écran : E7 Éditeur, surcouche non adressée « Choix de gabarit ».

## Objectif

Le Créateur change la mise en page de la double page courante : il choisit un autre gabarit de la famille du livre, voit à l'avance où iront ses photos, et ne perd que ce qui ne tient plus dans les nouveaux cadres, après confirmation.

## Décisions

| Sujet | Décision | Coût assumé |
|---|---|---|
| Contenu des anciens cadres | Report dans l'ordre : k-ième cadre photo vers k-ième cadre photo, k-ième cadre texte vers k-ième cadre texte | Le placement n'est pas toujours le meilleur : une photo portrait peut tomber dans un cadre paysage. Écartés : tout vider (le travail est perdu, sans « Annuler » avant 6e) ; affecter au mieux des proportions (calcul dans le front vérifié en base, ordre de lecture perdu, plus dur à expliquer) |
| Cadrage reporté | Remis au neutre (0,5 / 0,5 / 1) | Un recadrage soigné est perdu, même quand le nouveau cadre a les mêmes proportions |
| Ce qui ne tient plus | Les photos restent dans la réserve ; les textes sont effacés | Un texte perdu se ressaisit |
| Gabarits proposés | Intérieurs actifs de la famille du livre | Pas de changement de famille en cours de livre |
| Où vit la règle | `changer_gabarit`, en SQL ; le front calcule le même report pour l'aperçu, sans rien écrire | La règle est écrite deux fois, en SQL et en TypeScript ; les tests des deux portent sur les mêmes cas |
| Géométrie | Les emplacements sont supprimés puis recréés depuis le gabarit (RG-17) | Les identifiants d'emplacement changent : la sélection est effacée |
| Confirmation | Seulement si du contenu se perd | Un changement sans perte s'applique sans question |
| Aperçu | La double page courante, report appliqué, pour chaque gabarit | Une vignette de photo par cadre et par carte : quatre cartes au plus (Rythmé et Raconté), six cadres au plus par carte |
| Couverture et 4e | Hors de 6b | Changées sur E8 (6d) |

## Découpage

**`supabase/migrations/`** : nouvelle migration.

- `copier_geometrie(projet, double_page, gabarit)`, interne : l'insertion des emplacements depuis la définition du gabarit, sortie de `creer_double_page`, qui l'appelle désormais.
- `changer_gabarit(double_page, gabarit)`, appelée par `rpc`.

**`supabase/tests/`** : cas ajoutés à `fonctions_metier_test.sql`.

**`packages/shared/src/report.ts`**, nouveau : `reporterContenu`, fonction pure.

**`apps/web/src/api/doublesPages.ts`** : `listerDoublesPages` lit aussi `gabarit_origine_id` ; nouvelle fonction `changerGabarit`.

**`apps/web/src/ecrans/LivreEnCours.tsx`** : le loader garde la liste des gabarits de la famille (`listerGabaritsDuLivre`) au lieu du seul gabarit par défaut ; `gabaritParDefaut` est calculé à partir d'elle.

**`apps/web/src/editeur/`** :

| Fichier | Rôle |
|---|---|
| `SurcoucheGabarits.tsx` | Nouveau. Choix d'un gabarit, aperçu du report, confirmation |
| `BandeDoublesPages.tsx` | Gagne le bouton « Changer le gabarit » parmi ceux de la page courante |
| `Editeur.tsx` | Ouvre la surcouche, envoie l'écriture par le chemin des gestes de structure |

## `changer_gabarit`

```sql
changer_gabarit(p_double_page_id uuid, p_gabarit_id uuid) returns void
-- security definer
```

1. `verrouiller_interieure` : double page d'un autre `introuvable` ; couverture ou 4e `invalide`.
2. Le gabarit est actif, de rôle `interieur`, de la famille du modèle d'origine du livre ; sinon `invalide`, détail en français. Même lecture de la famille que `inserer_double_page`.
3. Si c'est déjà le gabarit de la double page, rien n'est écrit.
4. Le contenu est gardé de côté : `photo_id` des cadres photo, `contenu_texte` des cadres texte, chacun dans l'ordre des `indice`. Les cadres vides comptent : un cadre vide au rang 2 reste vide au rang 2.
5. Les emplacements sont supprimés, `gabarit_origine_id` est mis à jour, `copier_geometrie` recrée les emplacements.
6. Le contenu gardé est reporté rang par rang, cadrage neutre pour les photos. Ce qui dépasse le nombre de nouveaux cadres n'est pas reporté.

La double page garde son `id` et sa `position` : l'adresse `?page=` reste valide. Tout tient dans la transaction de la fonction : à la moindre erreur, l'ancienne double page reste intacte.

## Le report

```ts
reporterContenu(
  emplacements: { indice; nature; photo_id; contenu_texte }[],   // anciens
  cadres: Cadre[],                                                // définition du nouveau gabarit
): {
  emplacements: { indice; nature; photo_id; contenu_texte; cadrage }[];  // nouveaux, géométrie du gabarit
  photosPerdues: number;   // photos non vides qui ne sont plus reportées
  textesPerdus: number;    // textes non vides qui ne sont plus reportés
}
```

Même règle que l'étape 4 à 6 de `changer_gabarit`. Seules les photos et textes non vides sont comptés comme perdus. Une photo perdue qui est aussi posée dans un cadre reporté compte quand même : le compte porte sur les cadres, pas sur les photos.

## La surcouche

- S'ouvre depuis le bouton « Changer le gabarit » de la bande. Désactivé hors-ligne, pendant une écriture de structure, et quand la famille n'a qu'un gabarit.
- `Modale`, titre « Changer le gabarit ». Une carte par gabarit, dans l'ordre du catalogue : aperçu dessiné par `DoublePage` avec les emplacements de `reporterContenu`, nom du gabarit, « n photos · m textes ».
- Le gabarit actuel porte « Actuel » et n'est pas sélectionnable. Si `gabarit_origine_id` est vide, aucune carte ne le porte.
- Clavier : Tab ou flèches entre les cartes, Entrée pour choisir, Échap pour fermer. Cartes d'au moins 44 px.
- Choisir une carte sans perte applique le gabarit et ferme la surcouche.
- Choisir une carte avec perte ouvre la confirmation du design system : « Remplacer le gabarit ? », puis « 2 photos retourneront dans la réserve. » et / ou « 1 texte sera effacé. » — Garder l'actuel / **Remplacer**. « Garder l'actuel » revient aux cartes.

## Écriture

Le chemin des gestes de structure de 6a :

1. L'écriture d'emplacement en attente est terminée.
2. Rpc `changer_gabarit`, gestes de la bande désactivés pendant l'appel.
3. Relecture des doubles pages, `remplacerDoublesPages`, sélection effacée. La page courante ne change pas.

## Erreurs

| Cas | Conduite |
|---|---|
| Rpc refusée (gabarit désactivé entre-temps, famille) | Message dans un bandeau ; les doubles pages sont relues |
| Double page supprimée dans un autre onglet | `introuvable` ; relecture, la page courante est recalculée |
| Photo supprimée dans un autre onglet | Sans effet : la base reporte ce qu'elle a, la relecture montre le résultat réel |

## Tests

- **pgTAP, `changer_gabarit`** : double page d'un autre `introuvable` ; couverture `invalide` ; gabarit d'une autre famille `invalide` ; gabarit inactif refusé ; vers plus de cadres ; vers moins de cadres ; cadre vide au milieu reporté vide à son rang ; textes reportés ; cadrage remis au neutre ; même gabarit sans effet ; `gabarit_origine_id` et `position` après changement.
- **pgTAP, `creer_double_page`** : les tests existants passent toujours après l'extraction de `copier_geometrie`.
- **Vitest, `report.ts`** : les mêmes cas que pgTAP pour le report ; décompte des photos et textes perdus ; cadres vides non comptés.
- **Vitest, `SurcoucheGabarits.tsx`** : une carte par gabarit ; « Actuel » non sélectionnable ; choix sans perte appliqué directement ; choix avec perte suivi de la confirmation et de son texte ; « Garder l'actuel » n'écrit rien.
- **Playwright, `e2e/editeur.spec.ts`** : sur une double page à deux photos, passer à un gabarit à une photo, confirmer, recharger : nouveau gabarit, première photo conservée, seconde toujours dans la réserve.

## Hors de 6b

Gabarit de la couverture et de la 4e (6d) ; annuler un changement de gabarit (6e) ; changer de famille ; conserver un recadrage.

## Pour la documentation

Dans ce lot, avec accord :

- `docs/architecture.md` et `docs/modele-donnees.md`, règles garanties par les fonctions : `changer_gabarit` vérifie la famille du gabarit et reporte le contenu dans l'ordre.
- Question ouverte 2 du modèle de données dans Notion : tranchée, report dans l'ordre.

À la fin du lot, sur demande : statut de l'étape 42 dans le suivi Notion.
