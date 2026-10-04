# Bookopia

Application web de création de **livres photo personnalisés**, avec export **PDF prêt pour l'impression**.

Sa particularité : une **curation algorithmique**. Après l'import, l'application analyse les photos et propose d'écarter celles qui sont floues, mal exposées ou quasi identiques à une autre. Elle ne décide jamais à la place de l'utilisateur — elle lui évite de trier trois cents photos à la main.

Le parti pris produit est de **retrancher plutôt que d'ajouter** : un seul format de livre, des gabarits contraints, pas de canvas libre. Moins de choix, moins d'occasions de produire un livre raté.

> Projet réalisé dans le cadre du titre professionnel **Concepteur Développeur d'Applications (CDA)**.

---

## Stack

| | |
|---|---|
| Front | React · Vite · TypeScript |
| API | Fastify · TypeScript · Prisma |
| Worker | Node · sharp · pdf-lib |
| Base de données | PostgreSQL |
| Orchestration | Docker Compose |

L'ensemble est **auto-hébergé** et ne dépend d'aucun service tiers : la même commande lance le projet sur le serveur et sur une machine de développement.

### Organisation

```
apps/web        interface et moteur de gabarits
apps/api        API HTTP, authentification, règles métier
apps/worker     ingestion des photos et rendu PDF
packages/db     schéma Prisma, migrations
packages/shared types et validations partagés
docs/           documentation technique
```

Le **worker** est un processus séparé parce que traiter trois cents photos prend plusieurs minutes : l'API dépose une tâche et répond immédiatement, le worker dépile et travaille, l'avancement remonte au navigateur en temps réel. L'interface ne se fige jamais.

---

## Démarrage

### Prérequis

- Node.js 20 ou supérieur
- Docker et Docker Compose

### Installation

```bash
git clone <url-du-depot>
cd bookopia
cp .env.example .env
npm install
docker compose up -d
npm run db:migrate -w packages/db
```

### Développement

```bash
npm run dev -w apps/web      # http://localhost:5173
npm run dev -w apps/api      # http://localhost:3000
npm run dev -w apps/worker
```

### Vérifications

```bash
npm run lint
npm run typecheck
npm test
```

---

## Documentation

La documentation technique vit dans [`docs/`](./docs) : architecture et décisions, modèle de données, glossaire métier, conventions de code, design system.

Les agents IA qui contribuent au dépôt lisent [`CLAUDE.md`](./CLAUDE.md).

---

## Licence

Projet pédagogique. Tous droits réservés.
