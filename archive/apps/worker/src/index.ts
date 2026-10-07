import { creerClientPrisma } from "@bookopia/db";

const URL_BASE = process.env.DATABASE_URL;

if (!URL_BASE) {
  throw new Error("DATABASE_URL manquante");
}

const prisma = creerClientPrisma(URL_BASE);

// Échouer au démarrage plutôt qu'au premier job : Compose relance le conteneur et l'erreur est visible tout de suite.
await prisma.$queryRaw`SELECT 1`;

// La boucle de dépilage arrivera avec le rendu PDF, qui lira la table `export`.
// D'ici là, le processus reste vivant pour que Compose ne le relance pas en boucle.
console.log("worker démarré, base joignable");
setInterval(() => {}, 1 << 30);
