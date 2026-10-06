import type { PrismaClient } from "@bookopia/db";
import type { EntreeCreerProjet } from "@bookopia/shared";
import { creerDoublePageDepuisGabarit } from "./doubles-pages";
import { ErreurMetier } from "./erreurs";

// Le modèle est copié dans le projet : le modifier ensuite n'affecte aucun livre existant.
// Tout est créé dans une transaction : un projet sans couverture ni 4e ne doit jamais exister.
export async function creerProjet(
  prisma: PrismaClient,
  utilisateurId: string,
  entree: EntreeCreerProjet,
) {
  return prisma.$transaction(async (tx) => {
    const modele = await tx.modeleLivre.findUnique({
      where: { id: entree.modeleLivreId },
    });
    if (!modele?.actif) {
      throw new ErreurMetier("introuvable", "Modèle de livre introuvable");
    }
    if (
      entree.gabaritsInterieursIds.length !== modele.nombreDoublesPagesDepart
    ) {
      throw new ErreurMetier(
        "invalide",
        `Le modèle demande ${modele.nombreDoublesPagesDepart} doubles pages intérieures, ${entree.gabaritsInterieursIds.length} reçues`,
      );
    }
    const gabaritsInterieurs = await tx.gabarit.findMany({
      where: { id: { in: entree.gabaritsInterieursIds } },
      select: { id: true, famille: true },
    });
    const familles = new Map(
      gabaritsInterieurs.map((gabarit) => [gabarit.id, gabarit.famille]),
    );
    if (
      entree.gabaritsInterieursIds.some(
        (id) => familles.get(id) !== modele.famille,
      )
    ) {
      throw new ErreurMetier(
        "invalide",
        `Les gabarits intérieurs doivent appartenir à la famille ${modele.famille}`,
      );
    }

    const projet = await tx.projet.create({
      data: {
        utilisateurId,
        titre: entree.titre,
        themeId: modele.themeId,
        modeleOrigineId: modele.id,
      },
    });
    await creerDoublePageDepuisGabarit(
      tx,
      projet.id,
      "couverture",
      modele.gabaritCouvertureId,
      null,
    );
    for (const [index, gabaritId] of entree.gabaritsInterieursIds.entries()) {
      await creerDoublePageDepuisGabarit(
        tx,
        projet.id,
        "interieur",
        gabaritId,
        index + 1,
      );
    }
    await creerDoublePageDepuisGabarit(
      tx,
      projet.id,
      "quatrieme",
      modele.gabaritQuatriemeId,
      null,
    );
    return projet;
  });
}
