import {
  type AuthError,
  isAuthApiError,
  isAuthRetryableFetchError,
} from "@supabase/supabase-js";
import type { EntreeConnexion, EntreeInscription } from "@bookopia/shared";
import { supabase } from "../supabase";
import { ErreurNonAuthentifie, ErreurReseau, verifier } from "./client";

export type Utilisateur = {
  id: string;
  email: string;
  nom_affichage: string;
};

// Le Créateur a fait une erreur que le formulaire sait expliquer : identifiants faux, email déjà pris…
// code : code d'erreur de Supabase Auth.
export class ErreurAuthentification extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ErreurAuthentification";
  }
}

function traduire(erreur: AuthError): Error {
  if (isAuthRetryableFetchError(erreur)) {
    return new ErreurReseau();
  }
  if (isAuthApiError(erreur) && erreur.status < 500) {
    return new ErreurAuthentification(erreur.code ?? "inconnu");
  }
  return erreur;
}

export async function connecter(entree: EntreeConnexion) {
  const { error } = await supabase.auth.signInWithPassword({
    email: entree.email,
    password: entree.motDePasse,
  });
  if (error) throw traduire(error);
}

// Le nom d'affichage voyage dans les métadonnées : le trigger d'inscription crée la ligne utilisateur.
export async function inscrire(entree: EntreeInscription) {
  const { error } = await supabase.auth.signUp({
    email: entree.email,
    password: entree.motDePasse,
    options: { data: { nom_affichage: entree.nomAffichage } },
  });
  if (error) throw traduire(error);
}

export async function deconnecter() {
  await supabase.auth.signOut();
}

// getSession lit la session locale (renouvelée au besoin) sans aller-retour réseau superflu ;
// la lecture de la ligne utilisateur, filtrée par la RLS, confirme le jeton côté base.
export async function lireUtilisateurConnecte(): Promise<Utilisateur> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw traduire(error);
  if (!data.session) throw new ErreurNonAuthentifie();

  const ligne = verifier(
    await supabase
      .from("utilisateur")
      .select("id, nom_affichage")
      .eq("id", data.session.user.id)
      .maybeSingle(),
  );
  if (!ligne) throw new ErreurNonAuthentifie();

  return { ...ligne, email: data.session.user.email ?? "" };
}
