# Durcissement avant la mise en ligne : en-têtes, Auth, dépendances

Lot L9 · Sécurité & tests. Étapes BK-121 (en-têtes de sécurité du front), BK-119 (configuration de Supabase Auth), BK-122 (audit des dépendances dans la CI). Liées à BK-098 (mise en ligne). Aucun écran nouveau.

**Statut : à valider par Gautier.** Trois décisions restent ouvertes (§ Décisions à prendre). Rien n'est implémenté avant ta réponse.

## Constat

- Le front n'a aucun en-tête de sécurité. supabase-js garde le jeton de session dans `localStorage` : une faille XSS suffirait à le lire.
- `supabase/config.toml` est réglé pour le local : `site_url` sur `127.0.0.1`, `enable_confirmations = false`, `secure_password_change = false`, `password_requirements` vide. Déjà bons : 8 caractères minimum, inscription anonyme coupée, rotation des jetons, limites de débit.
- La CI lance `npm ci --no-audit`. `npm audit --omit=dev --audit-level=high` passe aujourd'hui sur cette branche : « found 0 vulnerabilities ».
- L'hébergeur du front n'est pas choisi (`docs/architecture.md`, « Hébergeur du front » en question ouverte). Or les en-têtes se déclarent dans un fichier propre à chaque hébergeur.

## Ce que la CSP doit autoriser (relevé dans le code)

| Directive | Valeur | Pourquoi |
|---|---|---|
| `default-src` | `'self'` | Base fermée |
| `script-src` | `'self' https://accounts.google.com/gsi/client` | Le bundle Vite, et le script Google Identity chargé par `import/google/connexion.ts`. Pas de `'unsafe-inline'`, pas de `'unsafe-eval'` |
| `style-src` | `'self' 'unsafe-inline'` | L'interface pose des attributs `style` (React, Tiptap, recadrage). Coût assumé : une injection de style reste possible, pas de script. Alternative écartée : un nonce par réponse, impossible avec un front statique |
| `font-src` | `'self'` | Nunito est servie par le dépôt (`styles/polices`) |
| `img-src` | `'self' data: blob: https://<projet>.supabase.co https://lh3.googleusercontent.com` | Photos en URL signée Storage, vignettes locales, avatar Google |
| `connect-src` | `'self' https://*.supabase.co https://accounts.google.com https://photospicker.googleapis.com https://*.googleusercontent.com` | API Supabase, Google Identity, Photos Picker, téléchargement des photos choisies |
| `frame-src` | `https://accounts.google.com` | Fenêtre de consentement Google Identity |
| `frame-ancestors` | `'none'` | Aucun affichage du front dans une iframe |
| `object-src` / `base-uri` / `form-action` | `'none'` / `'self'` / `'self'` | Réduit la surface |

Autres en-têtes : `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, et `Permissions-Policy` coupant caméra, micro et géolocalisation (aucun usage).

Le sous-domaine du projet Supabase hébergé n'est connu qu'après BK-098, et `vercel.json` ne lit pas de variable : la politique autorise `https://*.supabase.co`. Coût assumé : n'importe quel projet Supabase est joignable, pas seulement le nôtre ; à resserrer sur l'adresse exacte une fois le projet créé. En local, la CSP n'est pas posée (le serveur Vite ne la sert pas) ; elle se vérifie sur le front construit, servi avec ses en-têtes.

## Décisions à prendre

### 1. Hébergeur du front (pour BK-121)

| Option | Fichier d'en-têtes | Coût | Écart |
|---|---|---|---|
| **Vercel** | `vercel.json` à la racine (`headers`, et `rewrites` vers `index.html` pour le routeur) | Offre gratuite suffisante ; usage non commercial seulement dans l'offre Hobby | — |
| Netlify | `apps/web/public/_headers` + `_redirects` | Offre gratuite suffisante | — |
| Cloudflare Pages | `apps/web/public/_headers` + `_redirects` | Offre gratuite, sans limite de bande passante | — |
| GitHub Pages | Impossible : pas d'en-têtes personnalisés | Gratuit | Écarté : `frame-ancestors` ne fonctionne qu'en en-tête, pas en `<meta>` |

Recommandation : **Vercel**, comme annoncé dans la demande. Netlify et Cloudflare Pages ont le même fichier `_headers` et se substituent sans changer la politique. Ce choix tranche une question ouverte de `docs/architecture.md` : je propose la mise à jour, sans la faire sans ton accord.

### 2. Protection contre les mots de passe compromis (BK-119)

Option « Leaked password protection » de Supabase Auth (comparaison avec Have I Been Pwned).

| Option | Coût | Effet |
|---|---|---|
| **Ne pas l'activer** (recommandé) | Un mot de passe connu des fuites est accepté | Réservée au plan Pro de Supabase (25 $/mois) : disproportionné pour un projet de diplôme. Atténué par `password_requirements` et la limite de débit. À écrire dans le dossier comme risque accepté |
| L'activer | 25 $/mois (plan Pro) | Refuse les mots de passe de fuites connues |
| Vérifier côté navigateur (API HIBP « k-anonymity ») | Une dépendance réseau de plus, une entrée de plus dans `connect-src`, une règle métier hors de Supabase | Écarté : contredit « les règles métier vivent dans Supabase » |

### 3. Captcha sur l'inscription (BK-119)

| Option | Coût | Effet |
|---|---|---|
| **Pas de captcha** (recommandé) | Des inscriptions automatisées restent possibles, bornées par `sign_in_sign_ups` et `email_sent` ; avec la confirmation d'adresse activée, un compte sans adresse valide ne sert à rien | Zéro dépendance, zéro friction. À écrire dans le dossier comme risque accepté, à rouvrir si des inscriptions abusives apparaissent |
| Cloudflare Turnstile | Un script tiers (`challenges.cloudflare.com`) à autoriser dans la CSP, un composant d'inscription modifié, une dépendance à valider ; gratuit | Bloque l'essentiel des robots |
| hCaptcha | Idem, plus de friction pour l'utilisateur | Idem |

## Configuration d'Auth (BK-119)

`config.toml` sert le local et la CLI ; le projet hébergé se règle dans le tableau de bord (ou `supabase config push`, à ne lancer qu'avec ton accord, car il modifie un environnement réel). Le dépôt porte donc deux choses : les valeurs sûres dans `config.toml`, et la liste des réglages à poser en ligne.

| Réglage | Local (`config.toml`) | En ligne | Coût assumé |
|---|---|---|---|
| `enable_confirmations` | `false` (maintenu) | `true` | En local et en e2e, les comptes `@bookopia.test` se connectent sans boîte mail. En ligne, SMTP par défaut de Supabase : 2 e-mails par heure (`email_sent`), insuffisant dès quelques inscriptions. Il faudra un SMTP propre pour la démonstration (hors périmètre, à noter) |
| `secure_password_change` | `true` | `true` | Changer le mot de passe demande une connexion récente ; aucun écran ne le change aujourd'hui, donc aucun impact |
| `password_requirements` | vide (maintenu) | `lower_upper_letters_digits` | Un mot de passe sans majuscule, minuscule ou chiffre est refusé en ligne. Local inchangé : sept parcours e2e créent leur compte avec `parcours-e2e-local`, que la règle refuserait ; les changer toucherait des fichiers d'une autre branche. À aligner quand ces parcours seront stables |
| `site_url`, `additional_redirect_urls` | `http://localhost:5173` (le front de `npm run dev`, remplace un port 3000 inutilisé) | l'adresse du front en ligne, seule | Une seule adresse autorisée en ligne : pas de redirection vers un aperçu |
| Décisions 2 et 3 | — | consignées ci-dessus | |

L'adresse du front en ligne n'existe qu'après BK-098 : en attendant, les critères « adresse en ligne » (BK-119, vérification `curl -I` de BK-121) restent à faire sur le projet hébergé.

## Dépendances (BK-122)

- Un job de `ci.yml` (dans `code`, après `npm ci`) lance `npm audit --omit=dev --audit-level=high`. Un job séparé coûterait une installation de plus pour une vérification de quelques secondes.
- `.github/dependabot.yml` : mises à jour de `npm` et de `github-actions`, chaque semaine, groupées pour limiter le nombre de PR (une PR de sécurité part toujours à part). Choix noté dans le ticket : Dependabot plutôt que Renovate, car natif à GitHub, sans application à installer.
- Coût assumé : l'audit peut échouer un jour sans qu'aucun code n'ait changé (une alerte apparaît sur une dépendance existante). La CI rouge est alors le signal voulu ; les dépendances de développement sont écartées (`--omit=dev`) pour ne pas bloquer sur un outil qui ne part pas en production.
- Aucune dépendance nouvelle.

## Découpage et vérification

1. `ajoute l'audit des dépendances à la CI` et `configure Dependabot` (BK-122). Preuve : audit vert localement, CI verte.
2. `durcit la configuration locale d'Auth` (BK-119) : `config.toml`, puis `supabase db reset` / `supabase test db` et les e2e (inscription avec un mot de passe conforme).
3. `sert les en-têtes de sécurité du front` (BK-121) : fichier d'hébergeur selon la décision 1. Preuve : `npm run build -w apps/web` puis `vite preview`, en-têtes lus au `curl -I`, parcours (connexion, import local, export) sans violation dans la console ; Google Photos sans compte Google de test : à essayer à la main en ligne.
4. Liste des réglages Auth à poser sur le projet hébergé, dans la PR.

## Non traité (à reporter après BK-098)

- Réglages posés sur le projet hébergé, et vérification des en-têtes sur l'URL en ligne.
- SMTP propre pour la confirmation d'adresse.
- Mise à jour de `docs/architecture.md` (choix de l'hébergeur, risques acceptés) : sur ton accord.
