import { z } from "zod";

// Entrées validées par le front avant d'appeler Supabase, pour le confort du Créateur.
// La vérification qui fait foi est celle de la fonction SQL. utilisateurId n'y figure jamais :
// la base le lit dans le jeton (auth.uid()).

export const creerProjetSchema = z.object({
  titre: z.string().trim().min(1),
  modeleLivreId: z.uuid(),
  // Choisis par le moteur de gabarits du front ; creer_projet vérifie et copie, elle ne choisit pas.
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

// Normalisé ici plutôt qu'en base : l'unicité de l'email ne doit pas dépendre de la casse.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const inscriptionSchema = z.object({
  email: emailSchema,
  // Le minimum est aussi celui de Supabase Auth (minimum_password_length dans supabase/config.toml).
  motDePasse: z.string().min(8).max(128),
  nomAffichage: z.string().trim().min(1).max(80),
});

// Aucune règle de longueur à la connexion : la refuser trahirait la règle d'inscription
// sans rien protéger, Supabase Auth tranche de toute façon.
export const connexionSchema = z.object({
  email: emailSchema,
  motDePasse: z.string().min(1).max(128),
});

export type EntreeInscription = z.infer<typeof inscriptionSchema>;
export type EntreeConnexion = z.infer<typeof connexionSchema>;
