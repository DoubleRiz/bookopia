import type { PrismaClient } from "@bookopia/db";
import type { EntreePoserPhoto } from "@bookopia/shared";
import { ErreurMetier } from "./erreurs";

export async function poserPhoto(
  prisma: PrismaClient,
  utilisateurId: string,
  emplacementId: string,
  entree: EntreePoserPhoto,
) {
  const emplacement = await prisma.emplacement.findFirst({
    where: { id: emplacementId, projet: { utilisateurId } },
    select: { id: true, projetId: true, nature: true },
  });
  if (!emplacement) {
    throw new ErreurMetier("introuvable", "Emplacement introuvable");
  }
  if (emplacement.nature !== "photo") {
    throw new ErreurMetier(
      "invalide",
      "Un emplacement de texte ne reçoit pas de photo",
    );
  }
  // La base ne peut pas comparer le projet de la photo à celui de l'emplacement sans trigger.
  // Le projet d'une photo ne change jamais : le vérifier avant l'écriture suffit.
  const photo = await prisma.photo.findFirst({
    where: { id: entree.photoId, projetId: emplacement.projetId },
    select: { id: true },
  });
  if (!photo) {
    throw new ErreurMetier("introuvable", "Photo introuvable dans ce projet");
  }

  return prisma.emplacement.update({
    where: { id: emplacement.id },
    data: {
      photoId: photo.id,
      cadrageX: entree.cadrage.x,
      cadrageY: entree.cadrage.y,
      cadrageZoom: entree.cadrage.zoom,
    },
  });
}
