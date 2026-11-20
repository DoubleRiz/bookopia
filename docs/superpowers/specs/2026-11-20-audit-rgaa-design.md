# Audit RGAA et déclaration d'accessibilité

Lot L9 · Sécurité & tests. Étape BK-131. Pages auditées : E0 Accueil, E1 Connexion, E4 Mes livres (avec S1), E5 Import, E7 Éditeur, E9 Export, mentions légales, déclaration d'accessibilité.

## Objectif

Mesurer l'accessibilité réelle de Bookopia avec le RGAA 4.1.2, et publier le résultat dans une déclaration d'accessibilité liée depuis le pied de page. L'accueil annonce une cible « RGAA · WCAG 2.2 AA » : l'audit donne le taux réel, la déclaration le rend public.

## Critères d'acceptation (Notion)

- Échantillon choisi : accueil, connexion, Mes livres, import, éditeur, export.
- Taux de conformité calculé et non-conformités listées.
- Page de déclaration d'accessibilité publiée, liée depuis le pied de page.

## Décisions

| Sujet | Décision | Coût assumé |
|---|---|---|
| Où vit la grille | `docs/audit-rgaa.md`, versionnée avec le code audité | Un fichier de plus à tenir à jour à chaque nouvel audit. Écartée : page Notion (hors dépôt, non relue en PR) |
| Profondeur | Les 106 critères sur chaque page. Les critères qui demandent un lecteur d'écran restent « à vérifier » jusqu'à une séance VoiceOver avec Gautier | Le taux publié est provisoire tant qu'il reste des critères à vérifier. Écarté : un sous-ensemble de critères, qui ne donne pas de taux RGAA |
| Échantillon | Les six écrans de Notion, plus les mentions légales et la déclaration, comme le demande le RGAA | Deux pages statiques de plus à auditer |
| Taux | Taux global : critères conformes / critères applicables (conformes + non conformes), sur l'ensemble de l'échantillon. Un critère est non conforme s'il l'est sur une seule page | Les critères « à vérifier » sont exclus du calcul et listés, avec la fourchette qu'ils peuvent faire varier |
| PDF exporté | Non-conformité (13.3, 13.4) tant que Gautier n'a pas choisi entre baliser le PDF, offrir une version alternative ou déclarer une dérogation | Le taux reste plus bas |
| Accueil | La carte « Accessible » garde sa référence et gagne un lien vers la déclaration | Un lien de plus sur l'accueil |
| Mention dans le pied de page | Le lien porte l'état de conformité : « Accessibilité : partiellement conforme » | Le libellé change à chaque nouvel état. Les écrans du Créateur n'ont pas de pied de page : la mention n'y figure pas (noté dans la grille) |
| Correction des non-conformités | Hors de cette étape : chaque correction est une étape à part | La déclaration publie des défauts connus |

## Méthode

- Inspection scriptée (Playwright sur Chromium, serveur local) : titres, repères, noms accessibles, étiquettes, ordre de tabulation et anneau de focus, contrastes calculés, défilement à 320 px, espacement du texte.
- Vérifications visuelles sur captures : 320 px, 640 px (zoom 200 %), états d'erreur, surcouches.
- Clavier : parcours complet de chaque page, surcouches (ouverture, Échap, retour du focus), édition d'un cadre au clavier.
- Non fait : lecteur d'écran, validation du code source.
