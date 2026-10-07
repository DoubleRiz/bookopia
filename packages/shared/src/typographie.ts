import { z } from "zod";
import { STYLES_TEXTE, type StyleTexte } from "./gabarit";
import { clePolice, FAMILLES_POLICES } from "./polices";

// Interligne des textes de livre, en multiple de la taille : le même à l'écran et dans le PDF.
export const INTERLIGNE = 1.2;
export const MM_PAR_POINT = 25.4 / 72;

const policeDeStyleSchema = z
  .object({
    police: z.enum(FAMILLES_POLICES),
    graisse: z.int(),
    italique: z.boolean(),
    taille_pt: z.number().positive(),
  })
  .refine((police) => clePolice(police) !== null, {
    message: "Cette police n'existe pas dans le catalogue des fichiers",
  });

// La base ne valide pas ce JSON : un thème mal formé échoue ici, au chargement,
// plutôt qu'avec une police de substitution dans le PDF.
export const typographieSchema = z.object({
  titre: policeDeStyleSchema,
  legende: policeDeStyleSchema,
  // exterieur : calé sur le bord extérieur de la page où se trouve le cadre.
  alignement: z.enum(["gauche", "centre", "exterieur"]),
  ancrage: z.enum(["haut", "bas"]),
  styles_masques: z.array(z.enum(STYLES_TEXTE)),
});

export type Typographie = z.infer<typeof typographieSchema>;
export type PoliceDeStyle = Typographie["titre"];

// Ce que le rendu doit savoir du thème, à l'écran comme dans le PDF.
export const themeSchema = z.object({
  palette: z.object({
    fond: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    texte: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  bordure_cadre: z.object({ filet_pt: z.number().positive() }).nullable(),
  typographie: typographieSchema,
});

export type Theme = z.infer<typeof themeSchema>;

// Deux polices par thème : titre_page s'écrit comme un titre.
export function policeDuStyle(
  typographie: Typographie,
  style: StyleTexte,
): PoliceDeStyle {
  return style === "legende" ? typographie.legende : typographie.titre;
}
