// Jeton d'accès à Google Photos, obtenu par Google Identity Services (token client).
// Il vit en mémoire du module, une heure au plus : rien n'est écrit dans le navigateur.
const SCRIPT = "https://accounts.google.com/gsi/client";
const SCOPE =
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
const MARGE_MS = 60_000;

export class ErreurConnexionGoogle extends Error {
  constructor() {
    super("Connexion à Google impossible");
    this.name = "ErreurConnexionGoogle";
  }
}

let jetonEnMemoire: { valeur: string; expireA: number } | null = null;
let scriptCharge: Promise<void> | null = null;

export function googleConfigure() {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

// Chargé une seule fois, à la première demande. L'appelant peut le précharger pour que
// la fenêtre de consentement s'ouvre dans le geste du clic, sans être bloquée.
export function chargerScriptGoogle() {
  scriptCharge ??= new Promise<void>((fin, echec) => {
    const balise = document.createElement("script");
    balise.src = SCRIPT;
    balise.async = true;
    balise.onload = () => fin();
    balise.onerror = () => {
      scriptCharge = null;
      balise.remove();
      echec(new ErreurConnexionGoogle());
    };
    document.head.append(balise);
  });
  return scriptCharge;
}

export function oublierJeton() {
  jetonEnMemoire = null;
}

export async function demanderJeton(): Promise<string> {
  if (jetonEnMemoire && jetonEnMemoire.expireA - Date.now() > MARGE_MS) {
    return jetonEnMemoire.valeur;
  }
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) throw new ErreurConnexionGoogle();
  await chargerScriptGoogle();
  const google = window.google;
  if (!google) throw new ErreurConnexionGoogle();

  return new Promise<string>((fin, echec) => {
    google.accounts.oauth2
      .initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (reponse) => {
          if (reponse.error || !reponse.access_token) {
            echec(new ErreurConnexionGoogle());
            return;
          }
          jetonEnMemoire = {
            valeur: reponse.access_token,
            expireA: Date.now() + (reponse.expires_in ?? 0) * 1000,
          };
          fin(reponse.access_token);
        },
        // Fenêtre fermée ou bloquée par le navigateur.
        error_callback: () => echec(new ErreurConnexionGoogle()),
      })
      .requestAccessToken();
  });
}
