# Reprise des écritures Notion du 20 novembre 2026

Gautier a dupliqué l'espace Notion pour passer sur un compte personnel. La copie a été faite avant les écritures de la session BK-131, qui sont donc absentes du nouvel espace. Ce document les liste pour les rejouer à la main, ou avec le prompt de la fin.

Seules les écritures de la session BK-131 (PR #25) sont listées ici. Une écriture faite par une autre session après la duplication n'y figure pas. Pour la retrouver, comparer les dates de dernière modification dans l'ancien espace.

Base concernée : « 🗺️ Suivi du projet », page parente « Bookopia (Projet CDA) ».

## 1. Critères d'acceptation cochés

Seuls ces critères sont cochés. Tous ont une preuve dans la PR #25.

| Étape | Critère coché |
|---|---|
| BK-130 Déplacer le focus au changement d'écran | Après une navigation, le focus est sur le titre principal de l'écran |
| BK-129 Lien d'évitement « Aller au contenu » | Le lien apparaît au premier Tab et mène au contenu principal |
| BK-129 | Il reste invisible à la souris |
| BK-129 | Il suit l'anneau de focus du design system |
| BK-133 Découper le bundle par route | Poids du JavaScript de l'accueil mesuré avant et après |
| BK-133 | L'éditeur et pdf-lib sont des chunks séparés, chargés à l'ouverture de leur écran |
| BK-133 | Les tests e2e passent |
| BK-125 Page mentions légales | Éditeur, hébergeur et contact sont indiqués |
| BK-125 | La page est accessible sans compte |
| BK-125 | Le pied de page de l'accueil y mène |
| BK-134 Page politique de confidentialité | Une page de politique de confidentialité est accessible sans compte |
| BK-134 | Elle indique les données collectées, leur finalité, leur durée de conservation et ce que Google reçoit à l'import |
| BK-134 | Le pied de page de l'accueil y mène |
| BK-131 Audit RGAA et déclaration d'accessibilité | Échantillon choisi : accueil, connexion, Mes livres, import, éditeur, export |
| BK-131 | Taux de conformité calculé et non-conformités listées |
| BK-131 | Page de déclaration d'accessibilité publiée, liée depuis le pied de page |

Le critère « Vérifié à la main avec VoiceOver » de BK-130 reste décoché.

## 2. Propriété « Notes »

Le texte existant de chaque étape est conservé. Une ligne lui est ajoutée à la fin.

| Étape | Ligne ajoutée |
|---|---|
| BK-130 | PR #25 ouverte (2026-11-20). Reste à vérifier : l'annonce du titre avec VoiceOver. |
| BK-129 | PR #25 ouverte (2026-11-20). Reste à vérifier : le lien annoncé et suivi avec VoiceOver. Sur l'éditeur et l'export, il mène juste avant la barre du livre, qui est dans le `<main>`. |
| BK-133 | PR #25 ouverte (2026-11-20). JavaScript de l'accueil : 1 962 kB avant, 683,8 kB après (pages légales comprises). Rien à vérifier en plus. |
| BK-125 | PR #25 ouverte (2026-11-20). En suspens : le téléphone des hébergeurs (LCEN). L'hébergement Vercel et la région Supabase sont confirmés mais pas encore mis en place. |
| BK-134 | PR #25 ouverte (2026-11-20). La page annonce la suppression du compte depuis l'espace personnel : elle n'existe qu'avec BK-123. |
| BK-131 | PR #25 ouverte (2026-11-20). Taux provisoire 83,1 % (docs/audit-rgaa.md). Reste à vérifier : critères 7.1 (VoiceOver) et 8.2 (validation du code). Corrections listées dans une étape à part. |

## 3. Statuts

Aucun Statut n'a été changé. BK-130 est « En cours », les cinq autres « À faire ». `/fusionner-pr` les passera à « Terminé ».

## 4. Nouvelle étape BK-135

Dans l'ancien espace, elle porte le numéro BK-135. Dans le nouvel espace, le compteur automatique peut donner un autre numéro. Il faut alors reprendre ce numéro dans le titre.

| Propriété | Valeur |
|---|---|
| Étape | [BK-135] Corriger les non-conformités RGAA de l'audit |
| Lot | L9 · Sécurité & tests |
| Priorité | Essentiel |
| Statut | À faire |
| Livrable | Les 10 critères non conformes de l'audit RGAA corrigés, les 2 critères à vérifier tranchés, la grille et la déclaration d'accessibilité mises à jour |
| Notes | Issu de l'audit BK-131 du 2026-11-20 (PR #25, docs/audit-rgaa.md) : taux provisoire 83,1 %, partiellement conforme. Chaque correction peut devenir une étape à part si elle grossit. Le PDF (13.3, 13.4) attend une décision : balisage, version accessible ou dérogation. |

Contenu de la page :

```markdown
## Critères d'acceptation

- [ ] 1.3 Éditeur : chaque photo de la réserve porte un texte alternatif pertinent (lieu et date par défaut, modifiable, comme le prévoit le design system), pas son nom de fichier
- [ ] 3.3 Connexion, Mes livres : la bordure des champs de saisie atteint 3:1 sur blanc (aujourd'hui `#CDBCEB`, 1,75:1)
- [ ] 3.3 Éditeur : le cadre photo vide et le cadre texte se distinguent de la page à 3:1 (aujourd'hui 1,05 à 2,25:1)
- [ ] 6.1 Accueil : le nom des liens « Essayer ce modèle » contient leur texte visible (« Essayer ce modèle Généreux »)
- [ ] 6.1 Export : « Corriger » fait partie du nom des liens de la liste des points à vérifier
- [ ] 7.3 Éditeur : après Échap dans un cadre texte, le focus revient sur le cadre (aujourd'hui il tombe sur le `<body>`)
- [ ] 10.6 Connexion : « Créer un compte » se distingue du texte voisin autrement que par la couleur (soulignement)
- [ ] 10.7 Éditeur : la miniature de la double page courante montre l'anneau de focus (la règle `.courante .choisirPage` l'écrase)
- [ ] 10.11 Accueil : pas de défilement horizontal à 320 px (le bouton « Connexion » de l'en-tête dépasse)
- [ ] 10.11 Éditeur : à 320 px, le bouton « Changer le gabarit » ne recouvre plus la consigne
- [ ] 12.1 Accueil, Mes livres, pages légales : un second système de navigation (plan du site)
- [ ] 13.3 et 13.4 Export : décision prise pour le PDF (balisage, version accessible ou dérogation) et appliquée
- [ ] 7.1 Import, éditeur, export : composants personnalisés vérifiés avec VoiceOver
- [ ] 8.2 Toutes les pages : code source validé
- [ ] Grille `docs/audit-rgaa.md`, déclaration `/accessibilite` et libellé du pied de page mis à jour avec le nouveau taux

## À corriger au passage (hors critères RGAA)

- Connexion : après un refus, le focus tombe sur le `<body>` et les champs ne portent pas `aria-invalid`
- Import : ouvert par son adresse puis fermé par Échap, le focus tombe sur le `<body>`
- Export : après un rendu, deux encarts « PDF » s'affichent l'un sous l'autre
- Éditeur et export : le lien d'évitement mène juste avant la barre du livre, et les deux écrans ont le même `<h1>`
- Les écrans du Créateur n'affichent pas la mention de l'état de conformité (pas de pied de page)
- Déclaration : le 7.1 concerne l'import, l'éditeur et l'export, pas l'éditeur seul
```

## 5. Liens à mettre à jour dans la PR

La description de la PR #25 pointe vers les pages de l'ancien espace. Une fois les étapes reprises, remplacer ces six liens par ceux du nouvel espace. Le contrôle « Étape Notion liée » de la CI ne vérifie que la présence d'un lien.

## Prompt de reprise

À donner à un agent connecté au nouvel espace Notion, depuis la racine du dépôt :

```text
Lis docs/superpowers/plans/2026-11-20-reprise-notion.md. Il liste des écritures faites dans
l'ancien espace Notion de Bookopia après sa duplication. Rejoue-les dans le nouvel espace,
dans la base « 🗺️ Suivi du projet ».

1. Trouve la base par son nom. Ses identifiants ont changé avec la duplication : n'utilise
   aucun identifiant de l'ancien espace. Retrouve chaque étape par son titre (« [BK-130] … »).
2. Avant d'écrire, lis chaque étape. Si une modification y est déjà, ne la refais pas.
3. Section 1 : coche exactement les critères listés, aucun autre.
4. Section 2 : ajoute la ligne indiquée à la fin de la propriété Notes, sans toucher au texte
   existant.
5. Section 3 : ne change aucun Statut.
6. Section 4 : crée l'étape avec ses propriétés et son contenu. Lis le numéro que la base lui
   donne. S'il diffère de 135, reprends-le dans le titre et signale-le.
7. Termine par un compte rendu : ce qui a été écrit, ce qui y était déjà, et les liens des
   sept étapes dans le nouvel espace, pour mettre à jour la description de la PR #25.
```
