import { extname } from "node:path";
import type { Readable } from "node:stream";
import {
  CheminHorsRacine,
  FichierIntrouvable,
  type StockageDisque,
} from "@bookopia/stockage";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { ErreurMetier } from "../services/erreurs";

const TYPE_PAR_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

const requeteFichierSchema = z.object({
  expire: z.coerce.number().int().positive(),
  signature: z.string().regex(/^[A-Za-z0-9_-]+$/),
});

// Sur disque, c'est l'API qui sert l'URL signée. Aucune requête en base :
// l'autorisation a été vérifiée à l'émission de l'URL, la signature en est la preuve.
// Pas d'OptionsRoutes : cette route ne lit pas la base, elle ne reçoit que le stockage.
export const routesFichiers: FastifyPluginAsync<{
  stockage: StockageDisque;
}> = async (app, { stockage }) => {
  app.get("/fichiers/*", async (request, reply) => {
    const chemin = z.object({ "*": z.string() }).parse(request.params)["*"];
    const { expire, signature } = requeteFichierSchema.parse(request.query);

    if (!stockage.verifier(chemin, expire, signature)) {
      throw new ErreurMetier("interdit", "URL de fichier invalide ou expirée");
    }

    const type = TYPE_PAR_EXTENSION[extname(chemin)];
    if (!type) {
      throw new ErreurMetier("introuvable", "Fichier introuvable");
    }

    let flux: Readable;
    try {
      flux = await stockage.flux(chemin);
    } catch (erreur) {
      if (
        erreur instanceof FichierIntrouvable ||
        erreur instanceof CheminHorsRacine
      ) {
        throw new ErreurMetier("introuvable", "Fichier introuvable");
      }
      throw erreur;
    }

    // Le navigateur garde le fichier tant que l'URL est valide : une grille de vignettes ne se recharge pas à chaque affichage.
    const secondesRestantes = Math.max(
      0,
      expire - Math.floor(Date.now() / 1000),
    );
    reply
      .type(type)
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", `private, max-age=${secondesRestantes}`);
    if (type === "application/pdf") {
      reply.header("Content-Disposition", "attachment");
    }
    return reply.send(flux);
  });
};
