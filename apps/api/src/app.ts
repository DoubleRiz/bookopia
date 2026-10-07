import cookie from "@fastify/cookie";
import Fastify, { type FastifyServerOptions } from "fastify";
import { z } from "zod";
import type { PrismaClient } from "@bookopia/db";
import { installerGestionErreurs } from "./erreurs";
import { routesAuthentification } from "./routes/authentification";
import { routesSante } from "./routes/sante";

// Messages de validation en français : le front valide déjà avec les mêmes schémas,
// ceux de l'API ne s'affichent qu'en dernier recours.
z.config(z.locales.fr());

// Séparé du démarrage : les tests construisent l'application et l'interrogent sans ouvrir de port.
export async function construireApp(
  prisma: PrismaClient,
  options: FastifyServerOptions = {},
) {
  const app = Fastify(options);

  app.decorateRequest("utilisateur", null);
  installerGestionErreurs(app);
  await app.register(cookie);

  await app.register(routesSante, { prisma });
  await app.register(routesAuthentification, { prisma });

  return app;
}
