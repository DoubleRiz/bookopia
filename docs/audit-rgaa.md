# Audit RGAA

Grille d'audit de Bookopia selon le RGAA 4.1.2 (106 critères). Elle fonde la [déclaration d'accessibilité](../apps/web/src/ecrans/DeclarationAccessibilite.tsx) publiée sur `/accessibilite`. À refaire après chaque correction ou chaque nouvel écran.

## Résumé

| | |
|---|---|
| Date | 20 novembre 2026 |
| Auditeur | Gautier Baleda, avec un agent IA (auto-audit, pas d'auditeur externe) |
| Référentiel | RGAA 4.1.2, niveau AA |
| Corrections | 20 novembre 2026 (BK-135) : 6.1, 10.6 et 10.11 sur l'accueil corrigés ; 7.3 et 10.7 corrigés mais à revérifier dans l'éditeur |
| État | **Partiellement conforme** |
| Taux global | **89,5 %** : 51 critères conformes sur 57 applicables, 6 non conformes (83,1 % avant les corrections) |
| Critères à vérifier | 4 (7.1, 7.3, 8.2 et 10.7), exclus du taux. Selon leur résultat, le taux final est compris entre 83,6 % et 90,2 % |
| Taux moyen par page | 96,7 % (94,9 % avant les corrections) |

Le taux global compte un critère comme non conforme dès qu'il l'est sur une seule page. Le taux moyen fait la moyenne des taux de chaque page.

## Échantillon

| Code | Page | Adresse | Taux |
|---|---|---|---|
| A | E0 Accueil | `/` | 97,4 % |
| C | E1 Connexion | `/connexion` | 97,7 % |
| L | E4 Mes livres, avec les surcouches Nouveau livre, Renommer et Supprimer | `/livres`, `/livres/nouveau` | 96,1 % |
| I | E5 Import de photos (surcouche de l'éditeur) | `/livre/:id/import` | 100 % |
| E | E7 Éditeur | `/livre/:id` | 93,2 % |
| X | E9 Export | `/livre/:id/export` | 95,0 % |
| M | Mentions légales | `/mentions-legales` | 97,0 % |
| D | Déclaration d'accessibilité | `/accessibilite` | 97,0 % |

Les six premiers écrans sont ceux de l'étape BK-131. Les deux pages légales sont ajoutées parce que le RGAA les demande dans tout échantillon.

## Méthode

Environnement : Chromium (Playwright) sur macOS, serveur de développement local, Supabase local, compte de test créé par l'inscription, livre « Raconté » avec une photo.

| Vérification | Comment |
|---|---|
| Structure et noms | Relevé scripté du DOM et de l'arbre d'accessibilité : titres, repères, noms des liens, boutons et champs, attributs ARIA, identifiants dupliqués |
| Contrastes | Calcul du ratio de chaque texte visible sur son fond. Composants (bordures de champ, cadres) calculés à partir des couleurs relevées |
| Clavier | Parcours au Tab de chaque page, anneau de focus relevé à chaque arrêt. Surcouches : focus à l'ouverture, Échap, retour du focus. Éditeur : sélection d'un cadre, pose d'une photo, déplacement et édition d'un cadre texte |
| Lien d'évitement | Tab puis Entrée sur chaque page, y compris l'éditeur et l'export en plein cadre : le focus va bien au `<main>` |
| Zoom et reflow | Captures à 1280, 640 (zoom 200 %) et 320 px de large, mesure du défilement horizontal |
| Espacement du texte | Feuille de style imposant les valeurs du critère 10.12, puis recherche de texte coupé |
| Formulaires | Envoi vide, identifiants faux |

Ce qui n'a pas été fait :

- **Lecteur d'écran.** Aucune vérification avec VoiceOver. Elle conditionne le critère 7.1 et confirme le reste. À faire avec Gautier.
- **Validation du code source** (8.2). Pas de validateur installé dans le dépôt, et envoyer les pages au validateur du W3C demande l'accord de Gautier.
- **Mobile réel.** Le reflow est vérifié dans un navigateur de bureau à 320 px, pas sur un téléphone.

## Non-conformités

| Critère | Page | Défaut constaté |
|---|---|---|
| 1.3 | E | Les photos de la réserve sont nommées par leur nom de fichier (« phare.png »). Le design system prévoit un texte alternatif « lieu et date » par défaut, modifiable : il n'est pas implémenté |
| 3.3 | C, L | Bordure des champs de saisie `#CDBCEB` sur blanc : 1,75:1, pour 3:1 attendu. Le champ n'a pas d'autre limite visible |
| 3.3 | E | Cadre photo vide : fond `#F4EFFC` et bordure `#CDBCEB` sur la page `#FFF5E6` (1,05:1 et 1,62:1). Cadre texte : bordure `#A9A3BC`, 2,25:1 |
| 10.11 | E | Non corrigé (BK-135, éditeur non rejoué à 320 px). À 320 px, le bouton « Changer le gabarit » recouvre une partie de la consigne « Glissez une photo de la réserve sur un cadre… » |
| 12.1 | A, L, M, D | Un seul système de navigation (le menu). Ni plan du site ni recherche. Connexion, import, éditeur et export font partie d'un processus et en sont exemptés |
| 13.3, 13.4 | X | Le PDF exporté est un fichier d'impression : ni balisé, ni accompagné d'une version accessible |

## Corrections de BK-135

| Critère | Page | Correction | Vérifié |
|---|---|---|---|
| 6.1 | A | Nom du lien « Essayer ce modèle : Généreux », qui commence par l'intitulé visible | Test de composant |
| 6.1 | X | Seule la flèche de « Corriger → » est masquée : le mot est lu | Test de composant |
| 10.6 | C | « Créer un compte » est souligné | Capture à 320 px |
| 10.11 | A | En-tête resserré à moins de 720 px : plus de défilement horizontal (345 px mesurés avant, 320 après) | Mesure à 320 px |
| 7.3 | E | Après Échap, le focus retourne au cadre texte (`data-emplacement`) | Test de composant sur l'attribut seulement : à rejouer dans l'éditeur |
| 10.7 | E | Règle ajoutée pour que l'anneau de focus s'affiche sur la miniature courante | Aucune : à rejouer dans l'éditeur |

L'éditeur et l'export n'ont pas été essayés dans le navigateur : pas de Supabase local (Docker absent) pendant ces corrections.

## À vérifier

| Critère | Pages | Ce qu'il reste à faire |
|---|---|---|
| 7.1 | I, E, X | Composants personnalisés de l'éditeur : boutons sur `div` et sur `rect` SVG, groupe, figure, statut « Enregistré », zone de texte riche. Leur nom, leur rôle et leur état sont corrects dans l'arbre d'accessibilité : reste à les entendre avec VoiceOver |
| 7.3 | E | Corrigé (focus rendu au cadre texte après Échap). Reste à le rejouer dans l'éditeur : clavier, Échap en cours d'écriture |
| 10.7 | E | Corrigé (anneau de focus sur la miniature courante). Reste à le voir dans l'éditeur, au Tab |
| 8.2 | toutes | Validation du code source généré |

Restent aussi à essayer avec VoiceOver, sans critère RGAA propre :

- BK-130 : l'annonce du titre de l'écran à chaque navigation.
- BK-129 : le lien d'évitement, annoncé puis suivi.
- L'éditeur et l'export ont le même `<h1>`, le titre du livre. Le titre de l'onglet les distingue (8.6 conforme), mais un lecteur d'écran qui annonce le `<h1>` ne fait pas la différence entre les deux écrans.

## Remarques hors grille

Défauts constatés pendant l'audit qui ne rendent pas un critère non conforme, à corriger quand même :

- **Connexion** : après un refus (« Email ou mot de passe incorrect »), le message est annoncé (`role="alert"`) mais le focus retombe sur le `<body>`. Les champs ne portent pas `aria-invalid`.
- **Import** : ouvert par son adresse puis fermé par Échap, le focus retombe sur le `<body>` (ouvert par le bouton, il revient bien au bouton).
- **Export** : après un rendu, deux encarts « PDF » s'affichent l'un sous l'autre (« PDF à jour. », puis le fichier).
- **Accueil** : l'étiquette « Prêt à imprimer » (blanc sur corail, 3,06:1 en 12 px) fait partie d'une illustration masquée (`aria-hidden`). Texte décoratif, donc exempté du 3.2, mais le design system réserve le corail au grand texte.
- **Mention de l'état de conformité** : elle figure dans le pied de page des pages publiques. Les écrans du Créateur n'ont pas de pied de page et ne l'affichent pas.
- **Validation native** : sur la connexion, un champ obligatoire vide déclenche la bulle du navigateur, dans la langue du navigateur.

## Grille

A accueil · C connexion · L Mes livres · I import · E éditeur · X export · M mentions légales · D déclaration. C conforme · NC non conforme · NA non applicable · AV à vérifier.

### 1. Images

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | Image porteuse d'information : alternative | NA | NA | C | C | C | NA | NA | NA | C |
| 1.2 | Image de décoration ignorée | C | NA | C | C | C | C | NA | NA | C |
| 1.3 | Alternative pertinente | NA | NA | C | C | **NC** | NA | NA | NA | **NC** |
| 1.4 | Captcha ou image-test : alternative identifiant sa nature | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 1.5 | Captcha : autre solution d'accès | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 1.6 | Description détaillée si nécessaire | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 1.7 | Description détaillée pertinente | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 1.8 | Image texte remplacée par du texte stylé | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 1.9 | Légende d'image correctement reliée | NA | NA | NA | NA | C | NA | NA | NA | C |

### 2. Cadres

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 2.1 | Cadre : titre | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 2.2 | Titre de cadre pertinent | NA | NA | NA | NA | NA | NA | NA | NA | NA |

### 3. Couleurs

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 3.1 | Information pas donnée par la couleur seule | C | C | C | C | C | C | NA | NA | C |
| 3.2 | Contraste du texte | C | C | C | C | C | C | C | C | C |
| 3.3 | Contraste des composants d'interface | C | **NC** | **NC** | C | **NC** | C | NA | NA | **NC** |

### 4. Multimédia

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 4.1 | Média temporel : transcription ou audiodescription | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 4.2 | Transcription ou audiodescription pertinente | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 4.3 | Média synchronisé : sous-titres | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 4.4 | Sous-titres pertinents | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 4.5 | Média temporel : son ou contenu alternatif | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 4.6 | Audiodescription synchronisée pertinente | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 4.7 | Média clairement identifiable | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 4.8 | Média non temporel : alternative | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 4.9 | Alternative au média non temporel pertinente | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 4.10 | Son déclenché automatiquement contrôlable | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 4.11 | Média temporel contrôlable au clavier et à la souris | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 4.12 | Média non temporel compatible avec les technologies d'assistance | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 4.13 | Média temporel et non temporel : fonctionnalités accessibles | NA | NA | NA | NA | NA | NA | NA | NA | NA |

### 5. Tableaux

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 5.1 | Tableau complexe : résumé | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 5.2 | Résumé de tableau complexe pertinent | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 5.3 | Tableau de mise en forme linéarisé | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 5.4 | Tableau de données : titre associé | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 5.5 | Titre de tableau pertinent | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 5.6 | En-têtes de ligne et de colonne déclarés | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 5.7 | Cellules associées aux en-têtes | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 5.8 | Tableau de mise en forme sans éléments de tableau de données | NA | NA | NA | NA | NA | NA | NA | NA | NA |

### 6. Liens

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 6.1 | Lien explicite | C | C | C | C | C | C | C | C | C |
| 6.2 | Lien avec un intitulé | C | C | C | C | C | C | C | C | C |

### 7. Scripts

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 7.1 | Script compatible avec les technologies d'assistance | C | C | C | **AV** | **AV** | **AV** | C | C | **AV** |
| 7.2 | Alternative au script pertinente | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 7.3 | Script contrôlable au clavier et à la souris | C | C | C | C | **AV** | C | C | C | **AV** |
| 7.4 | Changement de contexte signalé ou à l'initiative de l'utilisateur | NA | C | C | C | C | C | NA | NA | C |
| 7.5 | Messages de statut restitués | NA | C | NA | C | C | C | NA | NA | C |

### 8. Éléments obligatoires

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 8.1 | Type de document défini | C | C | C | C | C | C | C | C | C |
| 8.2 | Code source valide | **AV** | **AV** | **AV** | **AV** | **AV** | **AV** | **AV** | **AV** | **AV** |
| 8.3 | Langue par défaut présente | C | C | C | C | C | C | C | C | C |
| 8.4 | Code de langue pertinent | C | C | C | C | C | C | C | C | C |
| 8.5 | Titre de page présent | C | C | C | C | C | C | C | C | C |
| 8.6 | Titre de page pertinent | C | C | C | C | C | C | C | C | C |
| 8.7 | Changements de langue indiqués | C | C | C | C | C | C | C | C | C |
| 8.8 | Code de langue des changements valide et pertinent | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 8.9 | Balises non utilisées à des fins de présentation | C | C | C | C | C | C | C | C | C |
| 8.10 | Changements du sens de lecture signalés | NA | NA | NA | NA | NA | NA | NA | NA | NA |

### 9. Structuration de l'information

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 9.1 | Information structurée par des titres | C | C | C | C | C | C | C | C | C |
| 9.2 | Structure du document cohérente | C | C | C | C | C | C | C | C | C |
| 9.3 | Listes correctement structurées | C | NA | C | C | C | C | C | C | C |
| 9.4 | Citations correctement indiquées | NA | NA | NA | NA | NA | NA | NA | NA | NA |

### 10. Présentation de l'information

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 10.1 | Feuilles de styles pour la présentation | C | C | C | C | C | C | C | C | C |
| 10.2 | Contenu visible présent sans feuilles de styles | C | C | C | C | C | C | C | C | C |
| 10.3 | Information compréhensible sans feuilles de styles | C | C | C | C | C | C | C | C | C |
| 10.4 | Texte lisible à 200 % | C | C | C | C | C | C | C | C | C |
| 10.5 | Couleurs de police et de fond déclarées ensemble | C | C | C | C | C | C | C | C | C |
| 10.6 | Lien dans un texte visible par rapport au texte | NA | C | NA | NA | NA | NA | C | C | C |
| 10.7 | Prise de focus visible | C | C | C | C | **AV** | C | C | C | **AV** |
| 10.8 | Contenus cachés ignorés par les technologies d'assistance | C | C | C | C | C | C | C | C | C |
| 10.9 | Information pas donnée par la forme, la taille ou la position seules | C | C | C | C | C | C | NA | NA | C |
| 10.10 | Idem, implémentation | C | C | C | C | C | C | NA | NA | C |
| 10.11 | Pas de défilement dans deux dimensions à 320 px | C | C | C | C | **NC** | C | C | C | **NC** |
| 10.12 | Espacement du texte redéfinissable | C | C | C | C | C | C | C | C | C |
| 10.13 | Contenus additionnels au survol ou au focus contrôlables | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 10.14 | Contenus additionnels en CSS atteignables au clavier | NA | NA | NA | NA | NA | NA | NA | NA | NA |

### 11. Formulaires

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 11.1 | Champ avec une étiquette | NA | C | C | C | C | NA | NA | NA | C |
| 11.2 | Étiquette pertinente | NA | C | C | C | C | NA | NA | NA | C |
| 11.3 | Étiquettes cohérentes entre champs de même fonction | NA | NA | C | NA | NA | NA | NA | NA | C |
| 11.4 | Étiquette accolée au champ | NA | C | C | C | NA | NA | NA | NA | C |
| 11.5 | Champs de même nature regroupés | NA | NA | C | NA | NA | NA | NA | NA | C |
| 11.6 | Regroupement avec une légende | NA | NA | C | NA | NA | NA | NA | NA | C |
| 11.7 | Légende pertinente | NA | NA | C | NA | NA | NA | NA | NA | C |
| 11.8 | Items de liste de choix regroupés | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 11.9 | Intitulé de bouton pertinent | NA | C | C | C | C | C | NA | NA | C |
| 11.10 | Contrôle de saisie pertinent | NA | C | C | NA | NA | NA | NA | NA | C |
| 11.11 | Suggestions de correction | NA | C | NA | NA | NA | NA | NA | NA | C |
| 11.12 | Données financières, juridiques ou personnelles : modifiables ou confirmées | NA | NA | C | NA | C | NA | NA | NA | C |
| 11.13 | Finalité d'un champ déduite (autocomplete) | NA | C | NA | NA | NA | NA | NA | NA | C |

### 12. Navigation

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 12.1 | Au moins deux systèmes de navigation | **NC** | NA | **NC** | NA | NA | NA | **NC** | **NC** | **NC** |
| 12.2 | Menu et navigation à la même place | C | NA | C | NA | NA | NA | C | C | C |
| 12.3 | Plan du site pertinent | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 12.4 | Plan du site atteignable de manière identique | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 12.5 | Moteur de recherche atteignable de manière identique | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 12.6 | Zones de regroupement atteignables ou évitables | C | C | C | C | C | C | C | C | C |
| 12.7 | Lien d'évitement ou d'accès rapide au contenu | C | C | C | C | C | C | C | C | C |
| 12.8 | Ordre de tabulation cohérent | C | C | C | C | C | C | C | C | C |
| 12.9 | Pas de piège au clavier | C | C | C | C | C | C | C | C | C |
| 12.10 | Raccourcis clavier d'une seule touche contrôlables | NA | NA | NA | NA | C | NA | NA | NA | C |
| 12.11 | Contenus additionnels atteignables au clavier | NA | NA | NA | NA | NA | NA | NA | NA | NA |

### 13. Consultation

| Critère | Intitulé | A | C | L | I | E | X | M | D | Site |
|---|---|---|---|---|---|---|---|---|---|---|
| 13.1 | Limite de temps contrôlable | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 13.2 | Pas de nouvelle fenêtre sans action de l'utilisateur | C | C | C | C | C | C | C | C | C |
| 13.3 | Document en téléchargement : version accessible | NA | NA | NA | NA | NA | **NC** | NA | NA | **NC** |
| 13.4 | Document en téléchargement accessible : même information | NA | NA | NA | NA | NA | **NC** | NA | NA | **NC** |
| 13.5 | Contenu cryptique : alternative | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 13.6 | Alternative au contenu cryptique pertinente | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 13.7 | Changements brusques de luminosité ou flash | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 13.8 | Contenu en mouvement ou clignotant contrôlable | NA | NA | NA | NA | NA | NA | NA | NA | NA |
| 13.9 | Contenu consultable quelle que soit l'orientation | C | C | C | C | C | C | C | C | C |
| 13.10 | Gestes complexes : alternative | NA | NA | NA | NA | C | NA | NA | NA | C |
| 13.11 | Actions au pointeur annulables | C | C | C | C | C | C | NA | NA | C |
| 13.12 | Fonctionnalités par mouvement de l'appareil : alternative | NA | NA | NA | NA | NA | NA | NA | NA | NA |
