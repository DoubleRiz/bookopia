try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {
  // pas de .env : on garde l'environnement du processus
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL manquante");
}

// Dérivée de DATABASE_URL plutôt que déclarée à part : les tests ne peuvent pas viser
// la base de développement par erreur.
const url = new URL(process.env.DATABASE_URL);
url.pathname = `${url.pathname}_test`;

export const URL_BASE_DE_TEST = url.toString();
export const URL_BASE_DE_DEVELOPPEMENT = process.env.DATABASE_URL;
