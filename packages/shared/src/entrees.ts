import { z } from "zod";

// Corps des requêtes d'API. projetId et utilisateurId n'y figurent jamais :
// le premier vient de la route, le second du jeton.

export const creerProjetSchema = z.object({
  titre: z.string().trim().min(1),
  modeleLivreId: z.uuid(),
  // Choisis par le moteur de gabarits du front ; l'API vérifie et copie, elle ne choisit pas.
  gabaritsInterieursIds: z.array(z.uuid()),
});

export const insererDoublePageSchema = z.object({
  gabaritId: z.uuid(),
  position: z.int().min(1),
});

export const deplacerDoublePageSchema = z.object({
  position: z.int().min(1),
});

export const cadrageSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  zoom: z.number().min(1),
});

export const poserPhotoSchema = z.object({
  photoId: z.uuid(),
  cadrage: cadrageSchema,
});

export type EntreeCreerProjet = z.infer<typeof creerProjetSchema>;
export type EntreeInsererDoublePage = z.infer<typeof insererDoublePageSchema>;
export type EntreeDeplacerDoublePage = z.infer<typeof deplacerDoublePageSchema>;
export type Cadrage = z.infer<typeof cadrageSchema>;
export type EntreePoserPhoto = z.infer<typeof poserPhotoSchema>;
