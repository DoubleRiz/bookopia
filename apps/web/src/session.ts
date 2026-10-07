import { redirect } from "react-router";
import type { z } from "zod";
import { ErreurAuthentification } from "./api/authentification";
import { ErreurNonAuthentifie, ErreurReseau } from "./api/client";

const ADRESSE_PAR_DEFAUT = "/livres";

// État « session expirée » : retour à la connexion sans perdre l'adresse demandée.
// Le loader qui lève ici n'a pas à savoir qu'une session existe.
export async function sousSession<T>(
  request: Request,
  charger: () => Promise<T>,
): Promise<T> {
  try {
    return await charger();
  } catch (erreur) {
    if (erreur instanceof ErreurNonAuthentifie) {
      const { pathname, search } = new URL(request.url);
      throw redirect(
        `/connexion?retour=${encodeURIComponent(pathname + search)}`,
      );
    }
    throw erreur;
  }
}

// Seule une adresse interne est suivie : sinon un lien piégé vers /connexion?retour=https://…
// enverrait le Créateur, juste connecté, sur un site tiers. « //x » et « /\x » sont des adresses externes.
export function adresseDeRetour(request: Request): string {
  const retour = new URL(request.url).searchParams.get("retour");
  if (
    retour &&
    retour.startsWith("/") &&
    !retour.startsWith("//") &&
    !retour.startsWith("/\\")
  ) {
    return retour;
  }
  return ADRESSE_PAR_DEFAUT;
}

export type ResultatFormulaire = {
  message?: string;
  champs?: Record<string, string[] | undefined>;
};

// Codes de Supabase Auth que le Créateur peut corriger. Un email inconnu et un mot de passe faux
// donnent le même code : le message ne révèle pas si le compte existe.
const ERREURS_AUTHENTIFICATION: Record<string, ResultatFormulaire> = {
  invalid_credentials: { message: "Email ou mot de passe incorrect" },
  user_already_exists: {
    champs: { email: ["Un compte existe déjà avec cet email"] },
  },
  email_exists: { champs: { email: ["Un compte existe déjà avec cet email"] } },
  email_address_invalid: { champs: { email: ["Adresse e-mail invalide"] } },
  weak_password: { champs: { motDePasse: ["Mot de passe trop faible"] } },
  over_request_rate_limit: {
    message: "Trop de tentatives. Patientez un instant, puis réessayez.",
  },
};

// Ce qu'un formulaire sait afficher : une erreur par champ, ou un message global.
// Le reste (base en erreur, contrat rompu) remonte à l'élément d'erreur de la route.
export function erreurDeFormulaire(erreur: unknown): ResultatFormulaire {
  if (erreur instanceof ErreurReseau) {
    return {
      message:
        "Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.",
    };
  }
  if (erreur instanceof ErreurAuthentification) {
    return (
      ERREURS_AUTHENTIFICATION[erreur.code] ?? {
        message: "La demande a été refusée. Réessayez.",
      }
    );
  }
  throw erreur;
}

// Le front valide d'abord, pour le confort : erreurs affichées sous chaque champ.
export function erreursDeValidation(erreur: z.ZodError): ResultatFormulaire {
  const champs: Record<string, string[]> = {};
  for (const probleme of erreur.issues) {
    const champ = String(probleme.path[0] ?? "");
    (champs[champ] ??= []).push(probleme.message);
  }
  return { champs };
}

export function texteDuChamp(donnees: FormData, nom: string): string {
  const valeur = donnees.get(nom);
  return typeof valeur === "string" ? valeur : "";
}
