import { beforeEach, describe, expect, it } from "vitest";
import {
  creerCatalogue,
  creerUtilisateur,
  ordreInterieures,
  prisma,
  viderBase,
} from "../../test/jeu-de-donnees";
import { creerProjet } from "./projets";

let catalogue: Awaited<ReturnType<typeof creerCatalogue>>;
let utilisateurId: string;

beforeEach(async () => {
  await viderBase();
  catalogue = await creerCatalogue();
  utilisateurId = (await creerUtilisateur("a@exemple.fr")).id;
});

describe("creerProjet", () => {
  it("copie le modèle : thème, couverture, intérieures ordonnées, 4e", async () => {
    const { modele, gabarits } = catalogue;
    const projet = await creerProjet(prisma, utilisateurId, {
      titre: "Islande",
      modeleLivreId: modele.id,
      gabaritsInterieursIds: [
        gabarits.interieurMixte.id,
        gabarits.interieurPleine.id,
      ],
    });

    expect(projet).toMatchObject({
      themeId: modele.themeId,
      modeleOrigineId: modele.id,
      utilisateurId,
    });

    const doublesPages = await prisma.doublePage.findMany({
      where: { projetId: projet.id },
    });
    const parRole = (role: string) =>
      doublesPages.filter((d) => d.role === role);
    expect(parRole("couverture")).toHaveLength(1);
    expect(parRole("quatrieme")).toHaveLength(1);
    expect(parRole("couverture")[0]).toMatchObject({
      position: null,
      gabaritOrigineId: gabarits.couverture.id,
    });

    const interieures = await prisma.doublePage.findMany({
      where: { projetId: projet.id, role: "interieur" },
      orderBy: { position: "asc" },
    });
    expect(interieures.map((d) => [d.position, d.gabaritOrigineId])).toEqual([
      [1, gabarits.interieurMixte.id],
      [2, gabarits.interieurPleine.id],
    ]);
  });

  it("copie la géométrie du gabarit dans les emplacements, avec le projetId", async () => {
    const { modele, gabarits } = catalogue;
    const projet = await creerProjet(prisma, utilisateurId, {
      titre: "Islande",
      modeleLivreId: modele.id,
      gabaritsInterieursIds: [
        gabarits.interieurMixte.id,
        gabarits.interieurPleine.id,
      ],
    });
    const [premiere] = await ordreInterieures(projet.id);
    const emplacements = await prisma.emplacement.findMany({
      where: { doublePageId: premiere?.id },
      orderBy: { indice: "asc" },
    });

    expect(emplacements).toMatchObject([
      {
        projetId: projet.id,
        indice: 0,
        nature: "photo",
        x: 10,
        y: 10,
        largeur: 280,
        hauteur: 280,
        photoId: null,
      },
      {
        projetId: projet.id,
        indice: 1,
        nature: "texte",
        x: 310,
        y: 120,
        largeur: 280,
        hauteur: 60,
      },
    ]);
  });

  it("une modification ultérieure du gabarit ne déplace pas les emplacements", async () => {
    const { modele, gabarits } = catalogue;
    const projet = await creerProjet(prisma, utilisateurId, {
      titre: "Islande",
      modeleLivreId: modele.id,
      gabaritsInterieursIds: [
        gabarits.interieurPleine.id,
        gabarits.interieurPleine.id,
      ],
    });
    await prisma.gabarit.update({
      where: { id: gabarits.interieurPleine.id },
      data: {
        definition: [
          {
            indice: 0,
            x: 50,
            y: 50,
            largeur: 10,
            hauteur: 10,
            nature: "photo",
          },
        ],
      },
    });

    const emplacements = await prisma.emplacement.findMany({
      where: { projetId: projet.id, doublePage: { role: "interieur" } },
    });
    expect(emplacements.every((e) => e.x === 0 && e.largeur === 600)).toBe(
      true,
    );
  });

  it("refuse un nombre d'intérieures différent du modèle", async () => {
    await expect(
      creerProjet(prisma, utilisateurId, {
        titre: "Islande",
        modeleLivreId: catalogue.modele.id,
        gabaritsInterieursIds: [catalogue.gabarits.interieurPleine.id],
      }),
    ).rejects.toMatchObject({ code: "invalide" });
  });

  it("refuse un gabarit intérieur d'une autre famille", async () => {
    const { modele, gabarits } = catalogue;
    await expect(
      creerProjet(prisma, utilisateurId, {
        titre: "Islande",
        modeleLivreId: modele.id,
        gabaritsInterieursIds: [
          gabarits.interieurPleine.id,
          gabarits.interieurAutreFamille.id,
        ],
      }),
    ).rejects.toMatchObject({ code: "invalide" });
  });

  it("refuse un gabarit de couverture à la place d'une intérieure, sans rien laisser en base", async () => {
    const { modele, gabarits } = catalogue;
    await expect(
      creerProjet(prisma, utilisateurId, {
        titre: "Islande",
        modeleLivreId: modele.id,
        gabaritsInterieursIds: [
          gabarits.interieurPleine.id,
          gabarits.couverture.id,
        ],
      }),
    ).rejects.toMatchObject({ code: "invalide" });
    expect(await prisma.projet.count()).toBe(0);
  });

  it("refuse un modèle dont la couverture porte un gabarit d'un autre rôle, sans rien laisser en base", async () => {
    const { modele, gabarits } = catalogue;
    await prisma.modeleLivre.update({
      where: { id: modele.id },
      data: { gabaritCouvertureId: gabarits.quatrieme.id },
    });
    await expect(
      creerProjet(prisma, utilisateurId, {
        titre: "Islande",
        modeleLivreId: modele.id,
        gabaritsInterieursIds: [
          gabarits.interieurPleine.id,
          gabarits.interieurPleine.id,
        ],
      }),
    ).rejects.toMatchObject({ code: "invalide" });
    expect(await prisma.projet.count()).toBe(0);
    expect(await prisma.doublePage.count()).toBe(0);
  });

  it("refuse un modèle désactivé", async () => {
    await prisma.modeleLivre.update({
      where: { id: catalogue.modele.id },
      data: { actif: false },
    });
    await expect(
      creerProjet(prisma, utilisateurId, {
        titre: "Islande",
        modeleLivreId: catalogue.modele.id,
        gabaritsInterieursIds: [
          catalogue.gabarits.interieurPleine.id,
          catalogue.gabarits.interieurPleine.id,
        ],
      }),
    ).rejects.toMatchObject({ code: "introuvable" });
  });
});
