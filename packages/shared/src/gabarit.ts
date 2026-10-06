import { z } from "zod";

// Coordonnées en millimètres, dans le repère de la double page.
export const cadreSchema = z.object({
  indice: z.int().nonnegative(),
  x: z.number(),
  y: z.number(),
  largeur: z.number().positive(),
  hauteur: z.number().positive(),
  nature: z.enum(["photo", "texte"]),
});

// La base ne valide pas ce JSON : un gabarit mal formé doit échouer ici, au chargement,
// plutôt que produire un PDF silencieusement faux.
export const definitionGabaritSchema = z
  .array(cadreSchema)
  .min(1)
  .refine(
    (cadres) =>
      new Set(cadres.map((cadre) => cadre.indice)).size === cadres.length,
    {
      message: "Deux cadres portent le même indice",
    },
  );

export type Cadre = z.infer<typeof cadreSchema>;
export type DefinitionGabarit = z.infer<typeof definitionGabaritSchema>;
