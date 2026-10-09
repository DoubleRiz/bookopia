// Google Photos Picker API : l'utilisateur choisit ses photos dans l'interface de Google,
// l'application ne lit jamais la bibliothèque. Les adresses `baseUrl` expirent au bout d'une heure.
const API = "https://photospicker.googleapis.com/v1";

// Google refuse le jeton (expiré ou révoqué) : l'utilisateur doit se reconnecter.
export class ErreurGoogleNonAutorise extends Error {
  constructor() {
    super("Accès à Google Photos refusé");
    this.name = "ErreurGoogleNonAutorise";
  }
}

// Le sélecteur est resté ouvert plus longtemps que Google ne l'autorise.
export class ErreurSelecteurExpire extends Error {
  constructor() {
    super("Le sélecteur Google a expiré");
    this.name = "ErreurSelecteurExpire";
  }
}

// Réseau coupé, ou réponse d'erreur de Google autre que 401.
export class ErreurGoogle extends Error {
  constructor(readonly statut: number | null) {
    super(statut ? `Google a répondu ${statut}` : "Google ne répond pas");
    this.name = "ErreurGoogle";
  }
}

export type SessionSelecteur = {
  id: string;
  pickerUri: string;
  mediaItemsSet: boolean;
  intervalleMs: number;
  delaiMs: number;
};

export type MediaGoogle = {
  id: string;
  createTime: string;
  type: "PHOTO" | "VIDEO" | string;
  mediaFile: { baseUrl: string; mimeType: string; filename: string };
};

type Options = { fetch?: typeof fetch };

// Google exprime ses durées en secondes avec un « s » : « 5s », « 1800s », « 3.5s ».
function dureeEnMs(duree: string | undefined, parDefaut: number) {
  const secondes = Number.parseFloat(duree ?? "");
  return Number.isFinite(secondes) ? secondes * 1000 : parDefaut;
}

async function appeler(
  jeton: string,
  adresse: string,
  { fetch: appelFetch = fetch, ...init }: RequestInit & Options = {},
) {
  let reponse: Response;
  try {
    reponse = await appelFetch(adresse, {
      ...init,
      headers: { Authorization: `Bearer ${jeton}` },
    });
  } catch (erreur) {
    // Une annulation n'est pas une panne : l'appelant la reconnaît à son nom.
    if (erreur instanceof DOMException && erreur.name === "AbortError") {
      throw erreur;
    }
    throw new ErreurGoogle(null);
  }
  if (reponse.status === 401) throw new ErreurGoogleNonAutorise();
  if (!reponse.ok) throw new ErreurGoogle(reponse.status);
  return reponse;
}

type SessionBrute = {
  id: string;
  pickerUri: string;
  mediaItemsSet?: boolean;
  pollingConfig?: { pollInterval?: string; timeoutIn?: string };
};

function lireSession(brute: SessionBrute): SessionSelecteur {
  return {
    id: brute.id,
    pickerUri: brute.pickerUri,
    mediaItemsSet: brute.mediaItemsSet === true,
    intervalleMs: dureeEnMs(brute.pollingConfig?.pollInterval, 5000),
    delaiMs: dureeEnMs(brute.pollingConfig?.timeoutIn, 1800_000),
  };
}

export async function creerSession(
  jeton: string,
  options: Options = {},
): Promise<SessionSelecteur> {
  const reponse = await appeler(jeton, `${API}/sessions`, {
    ...options,
    method: "POST",
  });
  return lireSession(await reponse.json());
}

type OptionsAttente = Options & {
  signal?: AbortSignal;
  // Injectables pour les tests : l'attente réelle dure des secondes.
  dormir?: (ms: number, signal?: AbortSignal) => Promise<void>;
  maintenant?: () => number;
};

function dormirReel(ms: number, signal?: AbortSignal) {
  return new Promise<void>((fin) => {
    const minuteur = setTimeout(fin, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(minuteur);
      fin();
    });
  });
}

// Interroge la session au rythme demandé par Google jusqu'à ce que l'utilisateur ait validé.
// Rend la session à jour, ou null si l'attente a été annulée.
export async function attendreSelection(
  jeton: string,
  session: SessionSelecteur,
  {
    signal,
    fetch: appelFetch,
    dormir = dormirReel,
    maintenant = Date.now,
  }: OptionsAttente = {},
): Promise<SessionSelecteur | null> {
  const echeance = maintenant() + session.delaiMs;
  let courante = session;
  while (!courante.mediaItemsSet) {
    await dormir(courante.intervalleMs, signal);
    if (signal?.aborted) return null;
    if (maintenant() > echeance) throw new ErreurSelecteurExpire();
    try {
      const reponse = await appeler(
        jeton,
        `${API}/sessions/${encodeURIComponent(session.id)}`,
        { fetch: appelFetch, signal },
      );
      courante = {
        ...lireSession(await reponse.json()),
        pickerUri: session.pickerUri,
      };
    } catch (erreur) {
      if (signal?.aborted) return null;
      throw erreur;
    }
  }
  return courante;
}

export async function listerMedias(
  jeton: string,
  idSession: string,
  options: Options = {},
): Promise<MediaGoogle[]> {
  const medias: MediaGoogle[] = [];
  let page: string | undefined;
  do {
    const parametres = new URLSearchParams({
      sessionId: idSession,
      pageSize: "100",
    });
    if (page) parametres.set("pageToken", page);
    const reponse = await appeler(
      jeton,
      `${API}/mediaItems?${parametres}`,
      options,
    );
    const corps: { mediaItems?: MediaGoogle[]; nextPageToken?: string } =
      await reponse.json();
    medias.push(...(corps.mediaItems ?? []));
    page = corps.nextPageToken;
  } while (page);
  return medias;
}

export async function supprimerSession(
  jeton: string,
  idSession: string,
  options: Options = {},
): Promise<void> {
  await appeler(jeton, `${API}/sessions/${encodeURIComponent(idSession)}`, {
    ...options,
    method: "DELETE",
  });
}

// `=d` demande l'original, EXIF compris. Le File porte le nom et la date de Google ;
// la date de prise de vue reste lue dans l'EXIF.
export async function telecharger(
  jeton: string,
  media: MediaGoogle,
  options: Options = {},
): Promise<File> {
  const reponse = await appeler(jeton, `${media.mediaFile.baseUrl}=d`, options);
  return new File([await reponse.blob()], media.mediaFile.filename, {
    type: media.mediaFile.mimeType,
    lastModified: Date.parse(media.createTime) || Date.now(),
  });
}
