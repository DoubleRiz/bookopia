# Corrections RGAA, lot B

Lot L9 · Sécurité & tests. Étape BK-135 (suite du lot A, PR #28). Écrans : E7 Éditeur, E1 Connexion, E4 Mes livres, E9 Export, pages publiques. Référence : `docs/audit-rgaa.md`.

## Objectif

Corriger les non-conformités restantes de l'audit RGAA du 20 novembre 2026, sauf 1.3, et revérifier dans l'éditeur les deux corrections du lot A qui n'avaient pas pu y être rejouées.

## Périmètre

| Critère | Pages | Traitement |
|---|---|---|
| 3.3 | C, L, E | Nouveau jeton de bordure contrasté pour les champs et les cadres de l'éditeur |
| 10.11 | E | Le bouton « Changer le gabarit » ne recouvre plus la consigne à 320 px |
| 12.1 | A, L, M, D | Page « Plan du site », liée depuis le pied de page. Le pied de page apparaît aussi sur les écrans du Créateur hors plein cadre |
| 13.3, 13.4 | X | Dérogation pour charge disproportionnée, déclarée |
| 7.3, 10.7 | E | Rejoués dans l'éditeur, avec Supabase en local |

Hors périmètre : 1.3, le texte alternatif des photos. Il deviendra une étape à part : colonne `texte_alternatif` modifiable, avec la date par défaut. Restent aussi 7.1 et 8.2, qui attendent VoiceOver et un validateur.

## Décisions

| Sujet | Décision | Coût assumé | Écarté |
|---|---|---|---|
| PDF exporté (13.3, 13.4) | Dérogation pour charge disproportionnée : fichier d'impression, fait des photos personnelles du Créateur. Une alternative fidèle demanderait de lui faire décrire chaque photo | Les deux critères restent non conformes dans le taux. Ils sont listés comme dérogation dans la déclaration | Baliser le PDF (pdf-lib ne balise pas, texte alternatif de chaque photo). Version HTML à côté (13.4 non tenu sans description des photos). « Non applicable » (contestable : le fichier est bien téléchargé depuis le site) |
| Bordures (3.3) | Jeton `--couleur-bordure-champ` `#8A76BB` : 3,90:1 sur blanc, 3,61:1 sur la page crème `#FFF5E6`, 3,45:1 sur lavande pâle. Il s'applique aux champs de saisie, aux cadres photo vides et aux cadres texte de l'éditeur | Deux couleurs de bordure à distinguer. Une ligne de plus dans le design system | Foncer `--couleur-bordure` partout : boutons secondaires et états inactifs alourdis sans nécessité, leur texte les délimite déjà |
| Navigation (12.1) | Page `/plan-du-site` qui liste toutes les pages atteignables sans contexte, liée depuis le pied de page. Le pied de page s'ajoute à Mes livres et à Nouveau livre (écrans du Créateur hors plein cadre) | Un pied de page de plus sur les écrans du Créateur. En échange, la mention de l'état de conformité y figure enfin (remarque de l'audit) | Moteur de recherche : rien à chercher dans un site de cinq pages. Lien « Plan du site » dans l'en-tête du Créateur : l'en-tête est déjà serré à 320 px |
| Éditeur à 320 px (10.11) | Sous 600 px, le bouton du gabarit quitte la position absolue et prend sa place dans le flux, au-dessus de la double page | Le bouton n'est plus dans l'angle du plan de travail sur téléphone | Réduire la consigne : le chevauchement revient avec une consigne plus longue |
| Taux | Recalculé dans `docs/audit-rgaa.md` et dans la déclaration, avec la date du jour | Grille et déclaration à tenir alignées à la main | — |

## Vérification

- Tests de composant : plan du site (un seul `<h1>`, un lien vers chaque page publique), pied de page présent sur Mes livres, déclaration (dérogation listée).
- Contrastes : ratios calculés et notés dans la grille.
- Navigateur, Supabase local, compte `@bookopia.test` : éditeur à 320 px (plus de chevauchement), Tab jusqu'à la miniature courante (anneau visible, 10.7), édition d'un cadre texte puis Échap (focus rendu au cadre, 7.3). Captures pour la PR.
