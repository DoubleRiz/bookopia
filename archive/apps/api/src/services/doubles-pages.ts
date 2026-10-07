import type { PrismaClient, RoleDoublePage, Transaction } from "@bookopia/db";
import {
  definitionGabaritSchema,
  type EntreeDeplacerDoublePage,
  type EntreeInsererDoublePage,
} from "@bookopia/shared";
import { ErreurMetier } from "./erreurs";
import {
  lireOrdreInterieures,
  placer,
  renumeroterInterieures,
} from "./ordre-interieures";
import { verrouillerProjet } from "./verrou-projet";

// La géométrie est copiée, pas référencée : modifier un gabarit ne doit pas déplacer
// les photos d'un livre déjà composé.
export async function creerDoublePageDepuisGabarit(
  tx: Transaction,
  projetId: string,
  role: RoleDoublePage,
  gabaritId: string,
  position: number | null,
) {
  const gabarit = await tx.gabarit.findUnique({ where: { id: gabaritId } });
  if (!gabarit?.actif) {
    throw new ErreurMetier("introuvable", "Gabarit introuvable");
  }
  if (gabarit.role !== role) {
    throw new ErreurMetier(
      "invalide",
      `Un gabarit de rôle ${gabarit.role} ne peut pas habiller une double page de rôle ${role}`,
    );
  }
  const cadres = definitionGabaritSchema.parse(gabarit.definition);

  const doublePage = await tx.doublePage.create({
    data: { projetId, role, position, gabaritOrigineId: gabarit.id },
  });
  await tx.emplacement.createMany({
    data: cadres.map((cadre) => ({
      projetId,
      doublePageId: doublePage.id,
      indice: cadre.indice,
      nature: cadre.nature,
      x: cadre.x,
      y: cadre.y,
      largeur: cadre.largeur,
      hauteur: cadre.hauteur,
    })),
  });
  return doublePage;
}

// Verrouille le projet de la double page et la renvoie ; seules les intérieures ont un ordre.
async function verrouillerInterieure(
  tx: Transaction,
  utilisateurId: string,
  doublePageId: string,
) {
  const doublePage = await tx.doublePage.findUnique({
    where: { id: doublePageId },
  });
  if (!doublePage) {
    throw new ErreurMetier("introuvable", "Double page introuvable");
  }
  await verrouillerProjet(tx, utilisateurId, doublePage.projetId);
  if (doublePage.role !== "interieur") {
    throw new ErreurMetier(
      "invalide",
      "La couverture et la 4e ne se déplacent, ne se suppriment ni ne se dupliquent",
    );
  }
  return doublePage;
}

export async function insererDoublePage(
  prisma: PrismaClient,
  utilisateurId: string,
  projetId: string,
  entree: EntreeInsererDoublePage,
) {
  return prisma.$transaction(async (tx) => {
    await verrouillerProjet(tx, utilisateurId, projetId);
    const ordre = await lireOrdreInterieures(tx, projetId);
    // Créée en dernier rang, puis replacée : le CHECK exige un rang dès l'insertion.
    const doublePage = await creerDoublePageDepuisGabarit(
      tx,
      projetId,
      "interieur",
      entree.gabaritId,
      ordre.length + 1,
    );
    await renumeroterInterieures(
      tx,
      projetId,
      placer([...ordre, doublePage.id], doublePage.id, entree.position),
    );
    return tx.doublePage.findUniqueOrThrow({ where: { id: doublePage.id } });
  });
}

export async function deplacerDoublePage(
  prisma: PrismaClient,
  utilisateurId: string,
  doublePageId: string,
  entree: EntreeDeplacerDoublePage,
) {
  return prisma.$transaction(async (tx) => {
    const doublePage = await verrouillerInterieure(
      tx,
      utilisateurId,
      doublePageId,
    );
    const ordre = await lireOrdreInterieures(tx, doublePage.projetId);
    await renumeroterInterieures(
      tx,
      doublePage.projetId,
      placer(ordre, doublePage.id, entree.position),
    );
    return tx.doublePage.findUniqueOrThrow({ where: { id: doublePage.id } });
  });
}

export async function supprimerDoublePage(
  prisma: PrismaClient,
  utilisateurId: string,
  doublePageId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const doublePage = await verrouillerInterieure(
      tx,
      utilisateurId,
      doublePageId,
    );
    await tx.doublePage.delete({ where: { id: doublePage.id } });
    // L'ordre relu garde le trou laissé par la suppression ; la renumérotation le referme.
    await renumeroterInterieures(
      tx,
      doublePage.projetId,
      await lireOrdreInterieures(tx, doublePage.projetId),
    );
  });
}

// La copie référence les mêmes photos : dupliquer une double page ne copie aucun fichier.
export async function dupliquerDoublePage(
  prisma: PrismaClient,
  utilisateurId: string,
  doublePageId: string,
) {
  return prisma.$transaction(async (tx) => {
    const source = await verrouillerInterieure(tx, utilisateurId, doublePageId);
    const ordre = await lireOrdreInterieures(tx, source.projetId);

    const copie = await tx.doublePage.create({
      data: {
        projetId: source.projetId,
        role: "interieur",
        position: ordre.length + 1,
        gabaritOrigineId: source.gabaritOrigineId,
      },
    });
    const emplacements = await tx.emplacement.findMany({
      where: { doublePageId: source.id },
    });
    await tx.emplacement.createMany({
      data: emplacements.map((emplacement) => ({
        projetId: emplacement.projetId,
        doublePageId: copie.id,
        indice: emplacement.indice,
        nature: emplacement.nature,
        x: emplacement.x,
        y: emplacement.y,
        largeur: emplacement.largeur,
        hauteur: emplacement.hauteur,
        photoId: emplacement.photoId,
        cadrageX: emplacement.cadrageX,
        cadrageY: emplacement.cadrageY,
        cadrageZoom: emplacement.cadrageZoom,
        contenuTexte: emplacement.contenuTexte,
      })),
    });

    await renumeroterInterieures(
      tx,
      source.projetId,
      placer([...ordre, copie.id], copie.id, ordre.indexOf(source.id) + 2),
    );
    return tx.doublePage.findUniqueOrThrow({ where: { id: copie.id } });
  });
}
