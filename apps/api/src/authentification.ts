import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from "fastify";
import type { PrismaClient } from "@bookopia/db";
import { connexionSchema, inscriptionSchema } from "@bookopia/shared";
import { ErreurMetier } from "./services/erreurs";
import {
  connecter,
  deconnecter,
  inscrire,
  type SessionOuverte,
  utilisateurDeSession,
} from "./services/sessions";

export const NOM_COOKIE_SESSION = "session";

declare module "fastify" {
  interface FastifyRequest {
    // Renseigné par exigerSession : c'est la seule source de l'identité, jamais un paramètre.
    utilisateur: SessionOuverte["utilisateur"] | null;
  }
}

// httpOnly : le script de la page ne lit pas le jeton, une faille XSS ne peut pas l'exfiltrer.
// SameSite=Lax : le cookie ne part pas sur une requête d'écriture venue d'un autre site (CSRF).
// Secure : localhost compte comme contexte sûr, le développement en HTTP fonctionne quand même.
function poserCookieSession(reply: FastifyReply, session: SessionOuverte) {
  reply.setCookie(NOM_COOKIE_SESSION, session.jeton, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: session.expireLe,
  });
}

export function creerExigerSession(
  prisma: PrismaClient,
): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest) => {
    const jeton = request.cookies[NOM_COOKIE_SESSION];
    const utilisateur = jeton
      ? await utilisateurDeSession(prisma, jeton)
      : null;
    if (!utilisateur) {
      throw new ErreurMetier("non_authentifie", "Session absente ou expirée");
    }
    request.utilisateur = utilisateur;
  };
}

export async function routesAuthentification(
  app: FastifyInstance,
  { prisma }: { prisma: PrismaClient },
) {
  const exigerSession = creerExigerSession(prisma);

  app.post("/auth/inscription", async (request, reply) => {
    const session = await inscrire(
      prisma,
      inscriptionSchema.parse(request.body),
    );
    poserCookieSession(reply, session);
    return reply.code(201).send({ utilisateur: session.utilisateur });
  });

  app.post("/auth/connexion", async (request, reply) => {
    const session = await connecter(
      prisma,
      connexionSchema.parse(request.body),
    );
    poserCookieSession(reply, session);
    return { utilisateur: session.utilisateur };
  });

  // Supprimer la ligne rend le jeton inutilisable partout, même copié ailleurs.
  app.post("/auth/deconnexion", async (request, reply) => {
    const jeton = request.cookies[NOM_COOKIE_SESSION];
    if (jeton) {
      await deconnecter(prisma, jeton);
    }
    reply.clearCookie(NOM_COOKIE_SESSION, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/auth/moi", { preHandler: exigerSession }, async (request) => {
    return { utilisateur: request.utilisateur };
  });
}
