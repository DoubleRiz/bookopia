import { beforeEach, describe, expect, it } from "vitest";
import {
  creerCatalogue,
  creerPhoto,
  creerUtilisateur,
  prisma,
  viderBase,
} from "../../test/jeu-de-donnees";
import { poserPhoto } from "./emplacements";
import { creerProjet } from "./projets";

let utilisateurId: string;
let catalogue: Awaited<ReturnType<typeof creerCatalogue>>;

async function nouveauProjet(proprietaireId: string) {
  return creerProjet(prisma, proprietaireId, {
    titre: "Islande",
    modeleLivreId: catalogue.modele.id,
    gabaritsInterieursIds: [
      catalogue.gabarits.interieurMixte.id,
      catalogue.gabarits.interieurMixte.id,
    ],
  });
}

async function emplacementDe(projetId: string, nature: "photo" | "texte") {
  return prisma.emplacement.findFirstOrThrow({
    where: { projetId, nature, doublePage: { role: "interieur" } },
  });
}

const CADRAGE = { x: 0.5, y: 0.5, zoom: 1 };

beforeEach(async () => {
  await viderBase();
  catalogue = await creerCatalogue();
  utilisateurId = (await creerUtilisateur("a@exemple.fr")).id;
});

describe("poserPhoto", () => {
  it("pose une photo du projet avec son cadrage", async () => {
    const projet = await nouveauProjet(utilisateurId);
    const photo = await creerPhoto(projet.id, "empreinte-1");
    const emplacement = await emplacementDe(projet.id, "photo");

    const pose = await poserPhoto(prisma, utilisateurId, emplacement.id, {
      photoId: photo.id,
      cadrage: CADRAGE,
    });
    expect(pose).toMatchObject({
      photoId: photo.id,
      cadrageX: 0.5,
      cadrageY: 0.5,
      cadrageZoom: 1,
    });
  });

  it("refuse une photo d'un autre projet du même utilisateur", async () => {
    const projet = await nouveauProjet(utilisateurId);
    const autreProjet = await nouveauProjet(utilisateurId);
    const photoAilleurs = await creerPhoto(autreProjet.id, "empreinte-1");
    const emplacement = await emplacementDe(projet.id, "photo");

    await expect(
      poserPhoto(prisma, utilisateurId, emplacement.id, {
        photoId: photoAilleurs.id,
        cadrage: CADRAGE,
      }),
    ).rejects.toMatchObject({ code: "introuvable" });
    expect(
      (
        await prisma.emplacement.findUniqueOrThrow({
          where: { id: emplacement.id },
        })
      ).photoId,
    ).toBeNull();
  });

  it("refuse un emplacement de texte", async () => {
    const projet = await nouveauProjet(utilisateurId);
    const photo = await creerPhoto(projet.id, "empreinte-1");
    const emplacement = await emplacementDe(projet.id, "texte");

    await expect(
      poserPhoto(prisma, utilisateurId, emplacement.id, {
        photoId: photo.id,
        cadrage: CADRAGE,
      }),
    ).rejects.toMatchObject({ code: "invalide" });
  });

  it("traite l'emplacement d'un autre utilisateur comme introuvable", async () => {
    const projet = await nouveauProjet(utilisateurId);
    const photo = await creerPhoto(projet.id, "empreinte-1");
    const emplacement = await emplacementDe(projet.id, "photo");
    const autre = await creerUtilisateur("b@exemple.fr");

    await expect(
      poserPhoto(prisma, autre.id, emplacement.id, {
        photoId: photo.id,
        cadrage: CADRAGE,
      }),
    ).rejects.toMatchObject({ code: "introuvable" });
  });
});
