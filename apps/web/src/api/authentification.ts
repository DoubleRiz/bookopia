import {
  type EntreeConnexion,
  type EntreeInscription,
  reponseUtilisateurSchema,
} from "@bookopia/shared";
import { requete } from "./client";

export async function connecter(entree: EntreeConnexion) {
  const { utilisateur } = await requete("/auth/connexion", {
    methode: "POST",
    corps: entree,
    schema: reponseUtilisateurSchema,
  });
  return utilisateur;
}

export async function inscrire(entree: EntreeInscription) {
  const { utilisateur } = await requete("/auth/inscription", {
    methode: "POST",
    corps: entree,
    schema: reponseUtilisateurSchema,
  });
  return utilisateur;
}

export async function deconnecter() {
  await requete("/auth/deconnexion", { methode: "POST" });
}

export async function lireUtilisateurConnecte() {
  const { utilisateur } = await requete("/auth/moi", {
    schema: reponseUtilisateurSchema,
  });
  return utilisateur;
}
