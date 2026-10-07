import { z } from "zod";

// Corps des réponses d'API réussies. Les dates voyagent en chaîne ISO : c'est ce que JSON transporte.

export const resumeProjetSchema = z.object({
  id: z.uuid(),
  titre: z.string(),
  brouillon: z.boolean(),
  modifieLe: z.iso.datetime(),
});

export const reponseListeProjetsSchema = z.object({
  projets: z.array(resumeProjetSchema),
});

export type ResumeProjet = z.infer<typeof resumeProjetSchema>;
export type ReponseListeProjets = z.infer<typeof reponseListeProjetsSchema>;
