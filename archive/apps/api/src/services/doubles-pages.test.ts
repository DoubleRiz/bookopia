import { beforeEach, describe, expect, it } from "vitest";
import {
  creerCatalogue,
  creerPhoto,
  creerUtilisateur,
  ordreInterieures,
  prisma,
  viderBase,
} from "../../test/jeu-de-donnees";
import {
  deplacerDoublePage,
  dupliquerDoublePage,
  insererDoublePage,
  supprimerDoublePage,
} from "./doubles-pages";
import { poserPhoto } from "./emplacements";
import { creerProjet } from "./projets";

let catalogue: Awaited<ReturnType<typeof creerCatalogue>>;
let utilisateurId: string;
let projetId: string;

// Projet à trois intérieures, identifiées par leur rang de départ.
let interieures: [string, string, string];

beforeEach(async () => {
  await viderBase();
  catalogue = await creerCatalogue();
  utilisateurId = (await creerUtilisateur("a@exemple.fr")).id;
  const { modele, gabarits } = catalogue;
  projetId = (
    await creerProjet(prisma, utilisateurId, {
      titre: "Islande",
      modeleLivreId: modele.id,
      gabaritsInterieursIds: [
        gabarits.interieurPleine.id,
        gabarits.interieurPleine.id,
      ],
    })
  ).id;
  await insererDoublePage(prisma, utilisateurId, projetId, {
    gabaritId: gabarits.interieurMixte.id,
    position: 3,
  });
  const [premiere, deuxieme, troisieme] = (
    await ordreInterieures(projetId)
  ).map((d) => d.id);
  if (!premiere || !deuxieme || !troisieme) {
    throw new Error("Le projet de départ doit avoir trois intérieures");
  }
  interieures = [premiere, deuxieme, troisieme];
});

async function ordreActuel() {
  const ordre = await ordreInterieures(projetId);
  // L'invariant vérifié par chaque test : des rangs de 1 à N, sans doublon ni trou.
  expect(ordre.map((d) => d.position)).toEqual(
    ordre.map((_, index) => index + 1),
  );
  return ordre.map((d) => d.id);
}

async function couverture() {
  return prisma.doublePage.findFirstOrThrow({
    where: { projetId, role: "couverture" },
  });
}

describe("insererDoublePage", () => {
  it("insère au rang demandé et décale les suivantes", async () => {
    const nouvelle = await insererDoublePage(prisma, utilisateurId, projetId, {
      gabaritId: catalogue.gabarits.interieurMixte.id,
      position: 2,
    });
    expect(nouvelle.position).toBe(2);
    expect(await ordreActuel()).toEqual([
      interieures[0],
      nouvelle.id,
      interieures[1],
      interieures[2],
    ]);
  });

  it("copie la géométrie du gabarit avec le projetId", async () => {
    const nouvelle = await insererDoublePage(prisma, utilisateurId, projetId, {
      gabaritId: catalogue.gabarits.interieurMixte.id,
      position: 1,
    });
    const emplacements = await prisma.emplacement.findMany({
      where: { doublePageId: nouvelle.id },
    });
    expect(emplacements).toHaveLength(2);
    expect(emplacements.every((e) => e.projetId === projetId)).toBe(true);
  });

  it("ne touche ni à la couverture ni à la 4e", async () => {
    await insererDoublePage(prisma, utilisateurId, projetId, {
      gabaritId: catalogue.gabarits.interieurMixte.id,
      position: 1,
    });
    const horsInterieur = await prisma.doublePage.findMany({
      where: { projetId, role: { not: "interieur" } },
    });
    expect(horsInterieur.map((d) => d.position)).toEqual([null, null]);
  });

  it("refuse un rang au-delà du dernier, sans rien créer", async () => {
    await expect(
      insererDoublePage(prisma, utilisateurId, projetId, {
        gabaritId: catalogue.gabarits.interieurMixte.id,
        position: 5,
      }),
    ).rejects.toMatchObject({ code: "invalide" });
    expect(await ordreActuel()).toEqual(interieures);
  });

  it("refuse un gabarit de couverture pour une double page intérieure", async () => {
    await expect(
      insererDoublePage(prisma, utilisateurId, projetId, {
        gabaritId: catalogue.gabarits.couverture.id,
        position: 1,
      }),
    ).rejects.toMatchObject({ code: "invalide" });
  });

  it("refuse un gabarit dont la définition est mal formée", async () => {
    const casse = await prisma.gabarit.create({
      data: {
        nom: "Cassé",
        role: "interieur",
        famille: "voyage",
        definition: [{ indice: 0 }],
      },
    });
    await expect(
      insererDoublePage(prisma, utilisateurId, projetId, {
        gabaritId: casse.id,
        position: 1,
      }),
    ).rejects.toThrow();
    expect(await ordreActuel()).toEqual(interieures);
  });

  it("garde des rangs uniques sous insertions concurrentes", async () => {
    await Promise.all(
      Array.from({ length: 5 }, () =>
        insererDoublePage(prisma, utilisateurId, projetId, {
          gabaritId: catalogue.gabarits.interieurPleine.id,
          position: 1,
        }),
      ),
    );
    expect(await ordreActuel()).toHaveLength(8);
  });

  it("traite le projet d'un autre utilisateur comme introuvable", async () => {
    const autre = await creerUtilisateur("b@exemple.fr");
    await expect(
      insererDoublePage(prisma, autre.id, projetId, {
        gabaritId: catalogue.gabarits.interieurPleine.id,
        position: 1,
      }),
    ).rejects.toMatchObject({ code: "introuvable" });
  });
});

describe("deplacerDoublePage", () => {
  it("déplace vers l'avant", async () => {
    await deplacerDoublePage(prisma, utilisateurId, interieures[2], {
      position: 1,
    });
    expect(await ordreActuel()).toEqual([
      interieures[2],
      interieures[0],
      interieures[1],
    ]);
  });

  it("déplace vers l'arrière", async () => {
    await deplacerDoublePage(prisma, utilisateurId, interieures[0], {
      position: 3,
    });
    expect(await ordreActuel()).toEqual([
      interieures[1],
      interieures[2],
      interieures[0],
    ]);
  });

  it("refuse de déplacer la couverture", async () => {
    await expect(
      deplacerDoublePage(prisma, utilisateurId, (await couverture()).id, {
        position: 1,
      }),
    ).rejects.toMatchObject({ code: "invalide" });
  });

  it("traite la double page d'un autre utilisateur comme introuvable", async () => {
    const autre = await creerUtilisateur("b@exemple.fr");
    await expect(
      deplacerDoublePage(prisma, autre.id, interieures[0], { position: 2 }),
    ).rejects.toMatchObject({
      code: "introuvable",
    });
  });
});

describe("supprimerDoublePage", () => {
  it("supprime et referme le trou", async () => {
    await supprimerDoublePage(prisma, utilisateurId, interieures[1]);
    expect(await ordreActuel()).toEqual([interieures[0], interieures[2]]);
    expect(
      await prisma.emplacement.count({
        where: { doublePageId: interieures[1] },
      }),
    ).toBe(0);
  });

  it("refuse de supprimer la couverture", async () => {
    await expect(
      supprimerDoublePage(prisma, utilisateurId, (await couverture()).id),
    ).rejects.toMatchObject({
      code: "invalide",
    });
  });
});

describe("dupliquerDoublePage", () => {
  it("place la copie juste après la source, avec les mêmes photos et le même cadrage", async () => {
    const photo = await creerPhoto(projetId, "empreinte-1");
    const emplacement = await prisma.emplacement.findFirstOrThrow({
      where: { doublePageId: interieures[0] },
    });
    await poserPhoto(prisma, utilisateurId, emplacement.id, {
      photoId: photo.id,
      cadrage: { x: 0.3, y: 0.6, zoom: 1.5 },
    });

    const copie = await dupliquerDoublePage(
      prisma,
      utilisateurId,
      interieures[0],
    );

    expect(await ordreActuel()).toEqual([
      interieures[0],
      copie.id,
      interieures[1],
      interieures[2],
    ]);
    const emplacementsCopie = await prisma.emplacement.findMany({
      where: { doublePageId: copie.id },
    });
    expect(emplacementsCopie).toMatchObject([
      {
        projetId,
        indice: 0,
        x: 0,
        largeur: 600,
        photoId: photo.id,
        cadrageX: 0.3,
        cadrageY: 0.6,
        cadrageZoom: 1.5,
      },
    ]);
    expect(await prisma.photo.count()).toBe(1);
  });

  it("refuse de dupliquer la 4e", async () => {
    const quatrieme = await prisma.doublePage.findFirstOrThrow({
      where: { projetId, role: "quatrieme" },
    });
    await expect(
      dupliquerDoublePage(prisma, utilisateurId, quatrieme.id),
    ).rejects.toMatchObject({ code: "invalide" });
  });
});
