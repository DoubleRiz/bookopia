// Les seuls types du script Google Identity Services utilisés ici : pas de paquet @types.
interface ReponseJetonGoogle {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface ClientJetonGoogle {
  requestAccessToken: (surcharge?: { prompt?: string }) => void;
}

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (configuration: {
          client_id: string;
          scope: string;
          callback: (reponse: ReponseJetonGoogle) => void;
          error_callback: (erreur: { type: string }) => void;
        }) => ClientJetonGoogle;
      };
    };
  };
}
