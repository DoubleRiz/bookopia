import Fastify from "fastify";
import { creerClientPrisma } from "@bookopia/db";

const PORT = Number(process.env.PORT_API ?? 3000);
const URL_BASE = process.env.DATABASE_URL;

if (!URL_BASE) {
  throw new Error("DATABASE_URL manquante");
}

const prisma = creerClientPrisma(URL_BASE);
const app = Fastify({ logger: true });

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

// La santé inclut la base : une API qui répond sans pouvoir lire ses données n'est pas en état de servir.
app.get("/sante", async (_request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { statut: "ok" };
  } catch (erreur) {
    app.log.error(erreur);
    return reply.code(503).send({ statut: "base_injoignable" });
  }
});

await app.listen({ port: PORT, host: "0.0.0.0" });
