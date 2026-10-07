# Bookopia

Application web de création de **livres photo personnalisés**, avec export **PDF prêt pour l'impression**.

Le parti pris produit est de **retrancher plutôt que d'ajouter** : un seul format de livre, des gabarits contraints, pas de canvas libre. Moins de choix, moins d'occasions de produire un livre raté.

> Projet réalisé dans le cadre du titre professionnel **Concepteur Développeur d'Applications (CDA)**.

---

## Stack

| | |
|---|---|
| Front | React · Vite · TypeScript · supabase-js |
| Base, authentification, fichiers | Supabase (PostgreSQL, Auth, Storage) |
| Rendu PDF | pdf-lib, dans le navigateur |

Il n'y a pas de serveur applicatif : le front parle directement à Supabase. La RLS protège chaque table, les règles métier sont des fonctions SQL appelées par `rpc`. Le navigateur prépare les photos et rend le PDF.

### Organisation

```
apps/web          interface, moteur de gabarits, préparation des photos, rendu PDF
packages/shared   schémas Zod, types générés depuis la base
supabase/         migrations SQL (tables, RLS, fonctions), seed du catalogue, tests pgTAP
docs/             documentation technique
archive/          code de l'architecture précédente, pour mémoire
```

---

## Démarrage

### Prérequis

- Node.js 24 (voir `.nvmrc`) et npm 10 ou supérieur
- Docker, pour Supabase en local
- La CLI Supabase

### Installation

```bash
git clone https://github.com/DoubleRiz/bookopia.git
cd bookopia
npm install
supabase start          # base, authentification, stockage et Studio en local
cp .env.example .env    # puis y reporter ANON_KEY affichée par « supabase status »
```

### Développement

```bash
npm run dev             # le front, sur http://localhost:5173
```

Studio, pour voir les tables, les règles RLS et les fichiers : http://127.0.0.1:54323.

### Base de données

```bash
supabase db reset       # rejoue les migrations et le seed
supabase test db        # tests pgTAP : RLS à deux utilisateurs, fonctions métier
supabase gen types typescript --local > packages/shared/src/base.ts
```

Après toute nouvelle migration, régénérer les types.

### Vérifications

```bash
npm run lint         # ESLint et Prettier
npm run typecheck
npm test             # Vitest
npm run format       # reformate le code avec Prettier
```

---

## Documentation

La documentation technique vit dans [`docs/`](./docs) : architecture et décisions, modèle de données, glossaire métier, conventions de code, design system.

Les agents IA qui contribuent au dépôt lisent [`CLAUDE.md`](./CLAUDE.md).

---

## Licence

Projet pédagogique. Tous droits réservés.
