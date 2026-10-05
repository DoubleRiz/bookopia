import { defineConfig } from "prisma/config";

// Prisma 7 ne lit plus le .env de lui-même. En conteneur, le fichier n'existe pas :
// les variables viennent de Compose.
try {
  process.loadEnvFile("../../.env");
} catch {
  // pas de .env : on garde l'environnement du processus
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
