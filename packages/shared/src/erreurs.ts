import { z } from "zod";

// Corps de toute réponse d'erreur de l'API, quelle qu'en soit l'origine.
// message : présent pour une erreur métier ; champs : présent pour une erreur de validation.
export const codeErreurSchema = z.enum([
  "invalide",
  "non_authentifie",
  "interdit",
  "introuvable",
  "conflit",
  "trop_volumineux",
  "erreur_interne",
]);

export const reponseErreurSchema = z.object({
  code: codeErreurSchema,
  message: z.string().optional(),
  champs: z.record(z.string(), z.array(z.string())).optional(),
});

export type CodeErreur = z.infer<typeof codeErreurSchema>;
export type ReponseErreur = z.infer<typeof reponseErreurSchema>;
