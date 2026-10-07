import type { PrismaClient } from "@bookopia/db";

// Convention des plugins de routes :
// - un fichier par ressource, qui exporte `routesX: FastifyPluginAsync<OptionsRoutes>` ;
//   une route qui ne lit pas la base déclare seulement ce qu'elle reçoit (ex. routesFichiers) ;
// - enregistré dans app.ts par `app.register(routesX, { prisma })` ;
// - toute entrée (body, params, query) passe par `schema.parse(...)` avec un schéma de @bookopia/shared ;
// - une route ne construit jamais de réponse d'erreur : elle lève ErreurMetier ou laisse remonter.
// prisma arrive par les options plutôt que par une décoration de l'instance : décoré, il serait
// accessible à toute route, alors que l'architecture réserve cet accès au dépôt.
export type OptionsRoutes = { prisma: PrismaClient };
