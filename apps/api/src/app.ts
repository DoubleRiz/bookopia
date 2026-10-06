import cookie from "@fastify/cookie";
import Fastify, { type FastifyServerOptions } from "fastify";
import { ZodError, z } from "zod";
import type { PrismaClient } from "@bookopia/db";
import type { StockageDisque } from "@bookopia/stockage";
import { routesAuthentification } from "./authentification";
import { routesFichiers } from "./fichiers";
import { type CodeErreurMetier, ErreurMetier } from "./services/erreurs";

const STATUT_PAR_CODE: Record<CodeErreurMetier, number> = {
  invalide: 400,
  non_authentifie: 401,
  interdit: 403,
  introuvable: 404,
  conflit: 409,
};

// Séparé du démarrage : les tests construisent l'application et l'interrogent sans ouvrir de port.
export async function construireApp(
  { prisma, stockage }: { prisma: PrismaClient; stockage: StockageDisque },
  options: FastifyServerOptions = {},
) {
  const app = Fastify(options);

  app.decorateRequest("utilisateur", null);
  await app.register(cookie);

  app.setErrorHandler((erreur, request, reply) => {
    if (erreur instanceof ErreurMetier) {
      return reply
        .code(STATUT_PAR_CODE[erreur.code])
        .send({ code: erreur.code, message: erreur.message });
    }
    if (erreur instanceof ZodError) {
      return reply
        .code(400)
        .send({ code: "invalide", champs: z.flattenError(erreur).fieldErrors });
    }
    request.log.error(erreur);
    return reply.code(500).send({ code: "erreur_interne" });
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

  await app.register(routesAuthentification, { prisma });
  await app.register(routesFichiers, { stockage });

  return app;
}
