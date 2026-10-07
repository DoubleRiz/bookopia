import type { Transaction } from "@bookopia/db";
import { ErreurMetier } from "./erreurs";

// Le verrou sérialise les écritures concurrentes sur un même projet : deux insertions
// simultanées liraient sinon le même nombre de doubles pages et produiraient un doublon de rang.
// Filtrer sur utilisateurId en fait aussi la vérification d'autorisation.
export async function verrouillerProjet(
  tx: Transaction,
  utilisateurId: string,
  projetId: string,
): Promise<void> {
  const lignes = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM projet
    WHERE id = ${projetId}::uuid AND "utilisateurId" = ${utilisateurId}::uuid
    FOR UPDATE`;
  if (lignes.length === 0) {
    throw new ErreurMetier("introuvable", "Projet introuvable");
  }
}
