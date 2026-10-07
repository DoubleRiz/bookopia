import { type ReponseErreur, reponseErreurSchema } from "@bookopia/shared";

// Même chemin en développement (proxy Vite) et en production (Caddy) : le front n'a qu'une origine,
// le cookie de session part donc sans réglage CORS.
const RACINE_API = "/api";

const STATUTS_PASSERELLE = new Set([502, 503, 504]);

// L'API a répondu, avec une erreur au format partagé.
export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    readonly corps: ReponseErreur,
  ) {
    super(corps.message ?? corps.code);
    this.name = "ErreurApi";
  }
}

// L'API n'a pas répondu du tout : réseau coupé, ou API arrêtée derrière le proxy.
// L'écran ne dit pas la même chose qu'une erreur de l'API.
export class ErreurReseau extends Error {
  constructor() {
    super("Le serveur ne répond pas");
    this.name = "ErreurReseau";
  }
}

// Le schéma de @bookopia/shared vérifie la réponse à l'exécution : un écart de contrat
// entre l'API et le front casse ici, avec un message, plutôt que trois composants plus loin.
type Schema<T> = { parse: (donnees: unknown) => T };

type Options<T> = {
  methode?: "GET" | "POST" | "PATCH" | "DELETE";
  corps?: unknown;
  schema?: Schema<T>;
};

export async function requete<T = void>(
  chemin: string,
  { methode = "GET", corps, schema }: Options<T> = {},
): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(`${RACINE_API}${chemin}`, {
      method: methode,
      headers:
        corps === undefined
          ? undefined
          : { "Content-Type": "application/json" },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  } catch {
    throw new ErreurReseau();
  }

  // Le proxy (Vite en développement, Caddy en production) répond à la place d'une API injoignable.
  if (STATUTS_PASSERELLE.has(reponse.status)) {
    throw new ErreurReseau();
  }
  if (!reponse.ok) {
    throw new ErreurApi(reponse.status, await lireErreur(reponse));
  }
  if (!schema) {
    return undefined as T;
  }
  return schema.parse(await reponse.json());
}

// Un corps qui ne suit pas le contrat (absent, HTML d'un intermédiaire) devient une erreur interne
// plutôt que de laisser fuir un corps inconnu.
async function lireErreur(reponse: Response): Promise<ReponseErreur> {
  try {
    const resultat = reponseErreurSchema.safeParse(await reponse.json());
    if (resultat.success) {
      return resultat.data;
    }
  } catch {
    // corps absent ou non JSON
  }
  return { code: "erreur_interne" };
}

export function estNonAuthentifie(erreur: unknown): boolean {
  return erreur instanceof ErreurApi && erreur.statut === 401;
}
