import type { FastifyPluginAsync } from "fastify";
import type { OptionsRoutes } from "./options";

// La santé inclut la base : une API qui répond sans pouvoir lire ses données n'est pas en état de servir.
export const routesSante: FastifyPluginAsync<OptionsRoutes> = async (
  app,
  { prisma },
) => {
  app.get("/sante", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { statut: "ok" };
    } catch (erreur) {
      app.log.error(erreur);
      return reply.code(503).send({ statut: "base_injoignable" });
    }
  });
};
