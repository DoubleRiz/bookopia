import { z } from "zod";

// titre_page : le titre de la page de titre, seul texte que le thème Silence laisse visible.
export const STYLES_TEXTE = ["titre", "titre_page", "legende"] as const;
export type StyleTexte = (typeof STYLES_TEXTE)[number];

// Coordonnées en millimètres, dans le repère de la double page.
// Un cadre texte porte un style, copié dans l'emplacement comme sa géométrie ; un cadre photo jamais.
export const cadreSchema = z
  .object({
    indice: z.int().nonnegative(),
    x: z.number(),
    y: z.number(),
    largeur: z.number().positive(),
    hauteur: z.number().positive(),
    nature: z.enum(["photo", "texte"]),
    style: z.enum(STYLES_TEXTE).optional(),
  })
  .refine(
    (cadre) => (cadre.nature === "texte") === (cadre.style !== undefined),
    {
      message: "Un cadre texte porte un style, un cadre photo n'en porte pas",
    },
  );

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
