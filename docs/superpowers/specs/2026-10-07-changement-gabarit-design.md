# Changement de gabarit

Lot L6 · Éditeur, deuxième sous-lot (6b). Étape 42 (changer le gabarit d'une double page). Écran : E7 Éditeur, surcouche non adressée « Choix de gabarit ».

## Objectif

Le Créateur change la mise en page de la double page courante : il choisit un autre gabarit de la famille du livre. Les cadres sont recréés vides ; s'il y avait des photos ou des textes, un avertissement le prévient avant.

## Décisions

| Sujet | Décision | Coût assumé |
|---|---|---|
| Contenu des anciens cadres | Rien n'est conservé : les cadres sont recréés vides (RG-17, à la lettre) | Le Créateur repose ses photos et ressaisit ses textes. Sans « Annuler » avant 6e, l'avertissement est la seule protection. Écartés : reporter dans l'ordre des cadres, affecter au mieux des proportions (règle écrite deux fois, en SQL et pour l'aperçu) |
| Photos | Restent dans la réserve | Aucune |
| Textes | Effacés | Un texte perdu se ressaisit |
| Avertissement | Seulement si la double page porte au moins une photo ou un texte | Une page vide change sans question |
| Gabarits proposés | Intérieurs actifs de la famille du livre | Pas de changement de famille en cours de livre |
| Aperçu | Le gabarit vide, dessiné par `DoublePage` | Le Créateur ne voit pas ses photos dans la nouvelle mise en page avant de choisir |
| Géométrie | Les emplacements sont supprimés puis recréés depuis le gabarit | Les identifiants d'emplacement changent : la sélection est effacée |
| Couverture et 4e | Hors de 6b | Changées sur E8 (6d) |

## Découpage

**`supabase/migrations/`** : nouvelle migration.

- `copier_geometrie(projet, double_page, gabarit)`, interne : l'insertion des emplacements depuis la définition du gabarit, sortie de `creer_double_page`, qui l'appelle désormais.
- `changer_gabarit(double_page, gabarit)`, appelée par `rpc`.

**`supabase/tests/`** : cas ajoutés à `fonctions_metier_test.sql`.

**`apps/web/src/api/doublesPages.ts`** : `listerDoublesPages` lit aussi `gabarit_origine_id` ; nouvelle fonction `changerGabarit`.

**`apps/web/src/ecrans/LivreEnCours.tsx`** : le loader garde la liste des gabarits de la famille (`listerGabaritsDuLivre`) au lieu du seul gabarit par défaut ; `gabaritParDefaut` est calculé à partir d'elle.

**`apps/web/src/editeur/`** :

| Fichier | Rôle |
|---|---|
| `SurcoucheGabarits.tsx` | Nouveau. Choix d'un gabarit, avertissement |
| `choixGabarit.ts` | Nouveau. Aperçu vide d'un gabarit, contenu à perdre, résumé d'une carte |
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
4. Les emplacements sont supprimés, `gabarit_origine_id` est mis à jour, `copier_geometrie` recrée les emplacements, vides.

La double page garde son `id` et sa `position` : l'adresse `?page=` reste valide. Tout tient dans la transaction de la fonction : à la moindre erreur, l'ancienne double page reste intacte.

## La surcouche

- S'ouvre depuis le bouton « Changer le gabarit » de la bande. Désactivé hors-ligne, pendant une écriture de structure, et quand la famille n'a qu'un gabarit.
- `Modale`, titre « Changer le gabarit ». Une carte par gabarit, dans l'ordre du catalogue : le gabarit vide dessiné par `DoublePage`, son nom, « n photos · m textes ».
- Le gabarit actuel porte « Actuel » et n'est pas sélectionnable. Si `gabarit_origine_id` est vide, aucune carte ne le porte.
- Clavier : Tab ou flèches entre les cartes, Entrée pour choisir, Échap pour fermer. Cartes d'au moins 44 px.
- Double page sans photo ni texte : choisir une carte applique le gabarit et ferme la surcouche.
- Sinon, choisir une carte ouvre la confirmation du design system : « Remplacer le gabarit ? », « Les photos et les textes de cette double page seront retirés. Les photos restent dans la réserve. » — Garder l'actuel / **Remplacer**. « Garder l'actuel » revient aux cartes.

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

## Tests

- **pgTAP, `changer_gabarit`** : double page d'un autre `introuvable` ; couverture `invalide` ; gabarit d'une autre famille `invalide` ; gabarit inactif refusé ; emplacements recréés selon le nouveau gabarit, tous vides ; même gabarit sans effet, contenu intact ; `gabarit_origine_id` et `position` après changement ; les photos retirées existent toujours.
- **pgTAP, `creer_double_page`** : les tests existants passent toujours après l'extraction de `copier_geometrie`.
- **Vitest, `choixGabarit.ts`** : contenu présent ou non (photo, texte, espaces) ; aperçu vide d'un gabarit ; résumé « n photos · m textes ».
- **Vitest, `SurcoucheGabarits.tsx`**, rendu statique comme `DoublePage` (pas de bibliothèque de test DOM) : une carte par gabarit, dans l'ordre ; « Actuel » non sélectionnable ; gabarit d'origine inconnu.
- **Playwright, `e2e/editeur.spec.ts`** : sur une double page avec une photo, changer de gabarit ; « Garder l'actuel » revient aux cartes ; confirmer ; recharger : nouveau gabarit actuel, cadres vides, photos toujours dans la réserve ; page vide : changement sans avertissement.

## Hors de 6b

Gabarit de la couverture et de la 4e (6d) ; annuler un changement de gabarit (6e) ; changer de famille ; conserver le contenu.

## Pour la documentation

Dans ce lot, avec accord :

- `docs/architecture.md` et `docs/modele-donnees.md`, règles garanties par les fonctions : `changer_gabarit` vérifie la famille du gabarit et recrée les cadres vides.
- Question ouverte 2 du modèle de données dans Notion : tranchée, rien n'est conservé.

À la fin du lot, sur demande : statut de l'étape 42 dans le suivi Notion.
