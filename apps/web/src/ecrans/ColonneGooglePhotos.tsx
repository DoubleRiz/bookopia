import { useEffect, useRef, useState } from "react";
import { Bouton } from "../composants/Bouton";
import {
  chargerScriptGoogle,
  demanderJeton,
  googleConfigure,
} from "../import/google/connexion";
import {
  attendreSelection,
  creerSession,
  ErreurGoogleNonAutorise,
  ErreurSelecteurExpire,
  listerMedias,
  supprimerSession,
  telecharger,
} from "../import/google/selecteur";
import type { Source } from "../import/importer";
import logoGooglePhotos from "../assets/google-photos.png";
import styles from "./ImportPhotos.module.css";

// Ce que la colonne remet à l'import. `terminer` supprime la session Google : les adresses
// des photos en dépendent, elle ne doit disparaître qu'une fois l'import fini.
export type SelectionGoogle = {
  sources: Source[];
  videosEcartees: number;
  terminer: () => Promise<void>;
};

type Etat =
  | { nom: "repos" }
  | { nom: "connexion" }
  | { nom: "attente"; pickerUri: string }
  | { nom: "erreur"; message: string };

function messageDErreur(erreur: unknown) {
  if (erreur instanceof ErreurSelecteurExpire) {
    return "Le sélecteur Google a expiré. Recommencez.";
  }
  if (erreur instanceof ErreurGoogleNonAutorise) {
    return "Votre accès à Google Photos a expiré. Reconnectez-vous.";
  }
  if (erreur instanceof TypeError || erreur instanceof Error) {
    return erreur.name === "ErreurConnexionGoogle"
      ? "La connexion à Google a échoué. Autorisez la fenêtre Google, puis réessayez."
      : "Google Photos ne répond pas. Vérifiez votre connexion, puis réessayez.";
  }
  return "Google Photos ne répond pas. Réessayez dans un instant.";
}

// Colonne de droite de E5 : le choix des photos se fait chez Google, dans un autre onglet.
// Démontée, elle annule l'attente et supprime la session, sauf si la sélection est déjà remise.
export function ColonneGooglePhotos({
  onSelection,
}: {
  onSelection: (selection: SelectionGoogle) => void;
}) {
  const [etat, setEtat] = useState<Etat>({ nom: "repos" });
  const controleur = useRef<AbortController | null>(null);
  const configure = googleConfigure();

  // Chargé d'avance : la fenêtre de consentement doit s'ouvrir dans le geste du clic.
  useEffect(() => {
    if (configure) void chargerScriptGoogle().catch(() => undefined);
  }, [configure]);

  useEffect(() => () => controleur.current?.abort(), []);

  if (!configure) {
    return <p className={styles.note}>Google Photos n'est pas configuré.</p>;
  }

  const annuler = () => {
    controleur.current?.abort();
    setEtat({ nom: "repos" });
  };

  const choisir = async () => {
    const mien = new AbortController();
    controleur.current = mien;
    setEtat({ nom: "connexion" });
    let jeton: string | undefined;
    let idSession: string | undefined;
    let remise = false;
    try {
      jeton = await demanderJeton();
      const session = await creerSession(jeton);
      idSession = session.id;
      if (mien.signal.aborted) return;
      setEtat({ nom: "attente", pickerUri: session.pickerUri });

      const fin = await attendreSelection(jeton, session, {
        signal: mien.signal,
      });
      if (!fin) return;
      const medias = await listerMedias(jeton, session.id);
      const photos = medias.filter((media) => media.type === "PHOTO");
      const jetonRemis = jeton;
      remise = true;
      onSelection({
        sources: photos.map((media) => ({
          nom: media.mediaFile.filename,
          obtenir: () => telecharger(jetonRemis, media),
        })),
        videosEcartees: medias.length - photos.length,
        terminer: () =>
          supprimerSession(jetonRemis, session.id).catch(() => undefined),
      });
    } catch (erreur) {
      if (!mien.signal.aborted) {
        setEtat({ nom: "erreur", message: messageDErreur(erreur) });
      }
    } finally {
      if (!remise && jeton && idSession) {
        void supprimerSession(jeton, idSession).catch(() => undefined);
      }
    }
  };

  return (
    <>
      {etat.nom === "repos" && (
        <button
          type="button"
          className={styles.zone}
          onClick={() => void choisir()}
        >
          <img className={styles.zoneIcone} src={logoGooglePhotos} alt="" />
          <span className={styles.zoneTitre}>Depuis Google Photos</span>
        </button>
      )}
      {etat.nom === "connexion" && (
        <Bouton type="button" disabled enCours>
          Connexion à Google…
        </Bouton>
      )}
      {etat.nom === "attente" && (
        <>
          <a
            className={styles.lienGoogle}
            href={etat.pickerUri}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir Google Photos ↗
          </a>
          <span className={styles.zoneAide} role="status">
            Choisissez vos photos dans l'onglet Google Photos, puis revenez ici.
          </span>
          <Bouton type="button" variante="secondaire" onClick={annuler}>
            Annuler
          </Bouton>
        </>
      )}
      {etat.nom === "erreur" && (
        <>
          <span className={styles.erreurColonne} role="alert">
            {etat.message}
          </span>
          <Bouton type="button" onClick={() => void choisir()}>
            Réessayer
          </Bouton>
        </>
      )}
    </>
  );
}
