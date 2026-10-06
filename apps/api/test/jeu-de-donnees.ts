import { creerClientPrisma } from "@bookopia/db";
import type { DefinitionGabarit } from "@bookopia/shared";
import { URL_BASE_DE_TEST } from "./url-base-de-test";

export const prisma = creerClientPrisma(URL_BASE_DE_TEST);

export async function viderBase(): Promise<void> {
  await prisma.$executeRaw`TRUNCATE utilisateur, theme, gabarit, "modeleLivre" CASCADE`;
}

const PLEINE_DOUBLE_PAGE: DefinitionGabarit = [
  { indice: 0, x: 0, y: 0, largeur: 600, hauteur: 300, nature: "photo" },
];

const PHOTO_ET_TEXTE: DefinitionGabarit = [
  { indice: 0, x: 10, y: 10, largeur: 280, hauteur: 280, nature: "photo" },
  { indice: 1, x: 310, y: 120, largeur: 280, hauteur: 60, nature: "texte" },
];

export async function creerUtilisateur(email: string) {
  return prisma.utilisateur.create({
    data: { email, motDePasseHache: "sans-objet", nomAffichage: email },
  });
}

// Un catalogue minimal : un modèle « voyage » à deux intérieures, et de quoi enfreindre chaque règle.
export async function creerCatalogue() {
  const theme = await prisma.theme.create({
    data: {
      nom: "Clair",
      policeTitre: "Serif",
      policeTexte: "Sans",
      palette: { fond: "#fff", texte: "#000", accent: "#c00" },
      rayonAngles: 0,
      margeInterieure: 5,
    },
  });
  const gabarit = (
    nom: string,
    role: "couverture" | "interieur" | "quatrieme",
    famille: string,
    definition: DefinitionGabarit,
  ) => prisma.gabarit.create({ data: { nom, role, famille, definition } });

  const couverture = await gabarit(
    "Couverture",
    "couverture",
    "voyage",
    PLEINE_DOUBLE_PAGE,
  );
  const quatrieme = await gabarit(
    "Quatrième",
    "quatrieme",
    "voyage",
    PHOTO_ET_TEXTE,
  );
  const interieurPleine = await gabarit(
    "Pleine",
    "interieur",
    "voyage",
    PLEINE_DOUBLE_PAGE,
  );
  const interieurMixte = await gabarit(
    "Mixte",
    "interieur",
    "voyage",
    PHOTO_ET_TEXTE,
  );
  const interieurAutreFamille = await gabarit(
    "Autre",
    "interieur",
    "mariage",
    PLEINE_DOUBLE_PAGE,
  );

  const modele = await prisma.modeleLivre.create({
    data: {
      nom: "Voyage",
      themeId: theme.id,
      gabaritCouvertureId: couverture.id,
      gabaritQuatriemeId: quatrieme.id,
      famille: "voyage",
      nombreDoublesPagesDepart: 2,
      cleApercu: "apercu/voyage.jpg",
    },
  });

  return {
    theme,
    modele,
    gabarits: {
      couverture,
      quatrieme,
      interieurPleine,
      interieurMixte,
      interieurAutreFamille,
    },
  };
}

export async function creerPhoto(projetId: string, empreinte: string) {
  return prisma.photo.create({
    data: {
      projetId,
      cleStockage: `photos/${empreinte}`,
      nomFichierOrigine: `${empreinte}.jpg`,
      empreinteFichier: empreinte,
      largeurPx: 4000,
      hauteurPx: 3000,
      sourceType: "upload",
    },
  });
}

// Rangs des intérieures dans l'ordre : sert à vérifier l'invariant 1..N sans doublon ni trou.
export async function ordreInterieures(projetId: string) {
  const interieures = await prisma.doublePage.findMany({
    where: { projetId, role: "interieur" },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  return interieures;
}
