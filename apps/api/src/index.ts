import { creerClientPrisma } from "@bookopia/db";
import { creerStockageDisque } from "@bookopia/stockage";
import { construireApp } from "./app";

const PORT = Number(process.env.PORT_API ?? 3000);
const URL_BASE = process.env.DATABASE_URL;
const DOSSIER_FICHIERS = process.env.DOSSIER_FICHIERS;
const SECRET_URL_SIGNEE = process.env.SECRET_URL_SIGNEE;

if (!URL_BASE) {
  throw new Error("DATABASE_URL manquante");
}
if (!DOSSIER_FICHIERS) {
  throw new Error("DOSSIER_FICHIERS manquant");
}
// Refuser de démarrer plutôt que de signer avec une valeur vide, que n'importe qui pourrait reproduire.
if (!SECRET_URL_SIGNEE) {
  throw new Error("SECRET_URL_SIGNEE manquant");
}

const prisma = creerClientPrisma(URL_BASE);
const stockage = creerStockageDisque({
  racine: DOSSIER_FICHIERS,
  secret: SECRET_URL_SIGNEE,
});
const app = await construireApp({ prisma, stockage }, { logger: true });

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

// Docker envoie SIGTERM à chaque arrêt du conteneur : on termine les requêtes en cours
// au lieu d'être tué dix secondes plus tard. Un second signal ne relance pas la fermeture.
let arretEnCours = false;

async function arreter(signal: NodeJS.Signals) {
  if (arretEnCours) {
    return;
  }
  arretEnCours = true;
  app.log.info({ signal }, "arrêt demandé");
  try {
    await app.close();
  } catch (erreur) {
    app.log.error(erreur, "échec de l'arrêt");
    process.exit(1);
  }
}

process.on("SIGTERM", () => void arreter("SIGTERM"));
process.on("SIGINT", () => void arreter("SIGINT"));

await app.listen({ port: PORT, host: "0.0.0.0" });
