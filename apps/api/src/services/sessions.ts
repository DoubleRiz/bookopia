import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@bookopia/db";
import type { EntreeConnexion, EntreeInscription } from "@bookopia/shared";
import { ErreurMetier } from "./erreurs";
import {
  HACHE_FACTICE,
  hacherMotDePasse,
  verifierMotDePasse,
} from "./mot-de-passe";

// Durée fixe, sans prolongation à l'usage : une session volée meurt à date connue,
// et aucune requête ne paie une écriture en base.
export const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const LONGUEUR_JETON = 32;

function hacherJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

export type SessionOuverte = {
  jeton: string;
  expireLe: Date;
  utilisateur: { id: string; email: string; nomAffichage: string };
};

// Un jeton neuf à chaque ouverture : un jeton connu avant la connexion
// ne devient jamais valide (pas de fixation de session).
async function ouvrirSession(
  prisma: PrismaClient,
  utilisateur: SessionOuverte["utilisateur"],
): Promise<SessionOuverte> {
  const jeton = randomBytes(LONGUEUR_JETON).toString("base64url");
  const expireLe = new Date(Date.now() + DUREE_SESSION_MS);
  await prisma.session.create({
    data: {
      utilisateurId: utilisateur.id,
      jetonHache: hacherJeton(jeton),
      expireLe,
    },
  });
  return { jeton, expireLe, utilisateur };
}

const CHAMPS_PUBLICS = { id: true, email: true, nomAffichage: true } as const;

export async function inscrire(
  prisma: PrismaClient,
  entree: EntreeInscription,
): Promise<SessionOuverte> {
  const motDePasseHache = await hacherMotDePasse(entree.motDePasse);
  let utilisateur: SessionOuverte["utilisateur"];
  try {
    utilisateur = await prisma.utilisateur.create({
      data: {
        email: entree.email,
        motDePasseHache,
        nomAffichage: entree.nomAffichage,
      },
      select: CHAMPS_PUBLICS,
    });
  } catch (erreur) {
    // L'unicité est tranchée par la contrainte : une vérification préalable
    // laisserait passer deux inscriptions simultanées.
    if (
      erreur instanceof Error &&
      "code" in erreur &&
      erreur.code === "P2002"
    ) {
      throw new ErreurMetier("conflit", "Un compte existe déjà avec cet email");
    }
    throw erreur;
  }
  return ouvrirSession(prisma, utilisateur);
}

export async function connecter(
  prisma: PrismaClient,
  entree: EntreeConnexion,
): Promise<SessionOuverte> {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { email: entree.email },
  });
  const valide = await verifierMotDePasse(
    entree.motDePasse,
    utilisateur?.motDePasseHache ?? HACHE_FACTICE,
  );
  // Même message pour un email inconnu et un mot de passe faux.
  if (!utilisateur || !valide) {
    throw new ErreurMetier(
      "non_authentifie",
      "Email ou mot de passe incorrect",
    );
  }
  // L'occasion de purger : sans cela, les sessions expirées d'un utilisateur s'accumulent.
  await prisma.session.deleteMany({
    where: { utilisateurId: utilisateur.id, expireLe: { lte: new Date() } },
  });
  return ouvrirSession(prisma, {
    id: utilisateur.id,
    email: utilisateur.email,
    nomAffichage: utilisateur.nomAffichage,
  });
}

export async function deconnecter(
  prisma: PrismaClient,
  jeton: string,
): Promise<void> {
  await prisma.session.deleteMany({
    where: { jetonHache: hacherJeton(jeton) },
  });
}

export async function utilisateurDeSession(
  prisma: PrismaClient,
  jeton: string,
): Promise<SessionOuverte["utilisateur"] | null> {
  const session = await prisma.session.findUnique({
    where: { jetonHache: hacherJeton(jeton) },
    select: { expireLe: true, utilisateur: { select: CHAMPS_PUBLICS } },
  });
  if (!session || session.expireLe <= new Date()) {
    return null;
  }
  return session.utilisateur;
}
