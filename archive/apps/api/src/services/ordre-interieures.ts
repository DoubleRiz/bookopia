import type { Transaction } from "@bookopia/db";
import { ErreurMetier } from "./erreurs";

export async function lireOrdreInterieures(
  tx: Transaction,
  projetId: string,
): Promise<string[]> {
  const interieures = await tx.doublePage.findMany({
    where: { projetId, role: "interieur" },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  return interieures.map((doublePage) => doublePage.id);
}

// Retire l'identifiant de l'ordre s'il y figure, puis le place au rang demandé (à partir de 1).
export function placer(
  ordre: readonly string[],
  id: string,
  position: number,
): string[] {
  const autres = ordre.filter((autre) => autre !== id);
  if (position < 1 || position > autres.length + 1) {
    throw new ErreurMetier(
      "invalide",
      `Position ${position} hors de 1..${autres.length + 1}`,
    );
  }
  return [...autres.slice(0, position - 1), id, ...autres.slice(position - 1)];
}

// Seul point d'écriture de `position` après la création du projet : la base ne porte pas
// d'unicité sur ce champ, c'est cette fonction qui garantit des rangs de 1 à N sans doublon ni trou.
// À appeler dans une transaction, projet verrouillé.
export async function renumeroterInterieures(
  tx: Transaction,
  projetId: string,
  ordre: readonly string[],
): Promise<void> {
  const actuelles = await tx.doublePage.findMany({
    where: { projetId, role: "interieur" },
    select: { id: true, position: true },
  });
  const positionsActuelles = new Map(actuelles.map((d) => [d.id, d.position]));

  const estPermutation =
    ordre.length === actuelles.length &&
    new Set(ordre).size === ordre.length &&
    ordre.every((id) => positionsActuelles.has(id));
  if (!estPermutation) {
    // Erreur de programmation, pas d'utilisateur : l'ordre a été calculé sur un état périmé.
    throw new Error(
      "L'ordre demandé ne correspond pas aux doubles pages intérieures du projet",
    );
  }

  for (const [index, id] of ordre.entries()) {
    if (positionsActuelles.get(id) !== index + 1) {
      await tx.doublePage.update({
        where: { id },
        data: { position: index + 1 },
      });
    }
  }
}
