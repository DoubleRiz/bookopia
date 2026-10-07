import type { PostgrestError } from "@supabase/supabase-js";

// Aucune session : jamais connecté, déconnecté, ou session expirée.
export class ErreurNonAuthentifie extends Error {
  constructor() {
    super("Aucune session");
    this.name = "ErreurNonAuthentifie";
  }
}

// Supabase n'a pas répondu du tout : réseau coupé, ou Supabase arrêté.
// L'écran ne dit pas la même chose qu'une erreur renvoyée par la base.
export class ErreurReseau extends Error {
  constructor() {
    super("Le serveur ne répond pas");
    this.name = "ErreurReseau";
  }
}

// La base a répondu par une erreur. code : code stable levé par une fonction SQL
// (« invalide », « introuvable »…) ou code PostgreSQL ; detail : explication pour le développeur.
export class ErreurBase extends Error {
  constructor(
    readonly code: string,
    readonly detail: string | null,
  ) {
    super(detail ?? code);
    this.name = "ErreurBase";
  }
}

type Reponse<T> = {
  data: T;
  error: PostgrestError | null;
  status: number;
};

// Déballe une réponse de supabase-js : la donnée, ou une erreur typée.
// Les fonctions SQL lèvent leur code stable dans message (voir les migrations).
export function verifier<T>({ data, error, status }: Reponse<T>): T {
  if (status === 0) {
    throw new ErreurReseau();
  }
  if (error) {
    if (error.code === "PGRST301" || status === 401) {
      throw new ErreurNonAuthentifie();
    }
    const codeMetier = error.code === "P0001" ? error.message : error.code;
    throw new ErreurBase(codeMetier, error.details || null);
  }
  return data;
}
