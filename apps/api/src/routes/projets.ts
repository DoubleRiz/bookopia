import type { FastifyPluginAsync } from "fastify";
import { listerProjets } from "../services/projets";
import { creerExigerSession, utilisateurConnecte } from "./authentification";
import type { OptionsRoutes } from "./options";

export const routesProjets: FastifyPluginAsync<OptionsRoutes> = async (
  app,
  { prisma },
) => {
  const exigerSession = creerExigerSession(prisma);

  app.get("/projets", { preHandler: exigerSession }, async (request) => {
    const projets = await listerProjets(
      prisma,
      utilisateurConnecte(request).id,
    );
    return { projets };
  });
};
