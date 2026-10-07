import type { FastifyInstance } from "fastify";
import { ZodError, z } from "zod";
import type { ReponseErreur } from "@bookopia/shared";
import { type CodeErreurMetier, ErreurMetier } from "./services/erreurs";

const STATUT_PAR_CODE: Record<CodeErreurMetier, number> = {
  invalide: 400,
  non_authentifie: 401,
  interdit: 403,
  introuvable: 404,
  conflit: 409,
};

// Fastify et ses plugins (JSON mal formé, corps trop gros, fichier trop lourd…) portent le statut HTTP sur l'erreur.
function statutHttp(erreur: unknown): number | undefined {
  if (
    typeof erreur === "object" &&
    erreur !== null &&
    "statusCode" in erreur &&
    typeof erreur.statusCode === "number"
  ) {
    return erreur.statusCode;
  }
  return undefined;
}

// Toute réponse d'erreur passe par ici : le front n'a qu'un format à connaître, reponseErreurSchema.
export function installerGestionErreurs(app: FastifyInstance): void {
  app.setErrorHandler((erreur, request, reply) => {
    if (erreur instanceof ErreurMetier) {
      return reply.code(STATUT_PAR_CODE[erreur.code]).send({
        code: erreur.code,
        message: erreur.message,
      } satisfies ReponseErreur);
    }
    if (erreur instanceof ZodError) {
      return reply.code(400).send({
        code: "invalide",
        champs: z.flattenError(erreur).fieldErrors,
      } satisfies ReponseErreur);
    }
    // Le message d'une erreur Fastify est en anglais et décrit le fonctionnement interne : seul le statut sort.
    const statut = statutHttp(erreur);
    if (statut !== undefined && statut >= 400 && statut < 500) {
      return reply.code(statut).send({
        code: statut === 413 ? "trop_volumineux" : "invalide",
      } satisfies ReponseErreur);
    }
    request.log.error(erreur);
    return reply
      .code(500)
      .send({ code: "erreur_interne" } satisfies ReponseErreur);
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ code: "introuvable" } satisfies ReponseErreur),
  );
}
