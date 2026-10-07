import {
  type ReactNode,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { ErreurBase, ErreurNonAuthentifie, ErreurReseau } from "../api/client";
import {
  type DoublePageDuLivre,
  deplacerDoublePage,
  dupliquerDoublePage,
  ecrireEmplacement,
  insererDoublePage,
  listerDoublesPages,
  supprimerDoublePage,
} from "../api/doublesPages";
import { Banniere } from "../composants/Banniere";
import { Bouton } from "../composants/Bouton";
import {
  DoublePage,
  type InteractionDoublePage,
  type PhotoAffichee,
} from "../composants/DoublePage";
import { Modale } from "../composants/Modale";
import { BandeDoublesPages } from "./BandeDoublesPages";
import styles from "./Editeur.module.css";
import {
  type ActionEditeur,
  emplacementDe,
  etatInitial,
  reduireEditeur,
} from "./etatEditeur";
import {
  creerFileEcritures,
  type FileEcritures,
  type StatutEnregistrement,
} from "./fileEcritures";
import { type PhotoDeReserve, Reserve } from "./Reserve";
import { SurcoucheRecadrage } from "./SurcoucheRecadrage";

type Photo = PhotoDeReserve & PhotoAffichee;

// Hors-ligne : bandeau persistant, gestes désactivés (spécifications fonctionnelles, §4).
function abonnerConnexion(prevenir: () => void) {
  window.addEventListener("online", prevenir);
  window.addEventListener("offline", prevenir);
  return () => {
    window.removeEventListener("online", prevenir);
    window.removeEventListener("offline", prevenir);
  };
}

function useEnLigne(): boolean {
  return useSyncExternalStore(
    abonnerConnexion,
    () => navigator.onLine,
    () => true,
  );
}

const LIBELLES_STATUT: Record<StatutEnregistrement, string> = {
  enregistre: "Enregistré",
  enregistrement: "Enregistrement…",
  echec: "Non enregistré",
};

// E7 : une double page intérieure à la fois, la bande des intérieures, la réserve.
// Les gestes sur un emplacement s'affichent tout de suite et partent par la file d'écriture ;
// les gestes de structure passent par les fonctions SQL, puis les doubles pages sont relues.
export function Editeur({
  projetId,
  fond,
  doublesPages,
  photos,
  gabaritParDefautId,
  actionsLivre,
  surImporter,
  surSupprimerPhoto,
}: {
  projetId: string;
  fond: string;
  doublesPages: DoublePageDuLivre[];
  photos: Photo[];
  gabaritParDefautId: string | null;
  actionsLivre: ReactNode;
  surImporter: () => void;
  surSupprimerPhoto: (photo: PhotoDeReserve) => void;
}) {
  const [etat, dispatch] = useReducer(
    reduireEditeur,
    doublesPages,
    etatInitial,
  );
  // Le loader repasse après une composition, un import ou une suppression de photo.
  useEffect(() => {
    dispatch({ type: "remplacerDoublesPages", doublesPages });
  }, [doublesPages]);

  // L'état vu par les gestes, qui le lisent hors du rendu : deux gestes rapides se suivent
  // sans attendre que React ait redessiné.
  const etatCourant = useRef(etat);
  useEffect(() => {
    etatCourant.current = etat;
  }, [etat]);

  const [statut, setStatut] = useState<StatutEnregistrement>("enregistre");
  const [message, setMessage] = useState<string | null>(null);
  const [structureEnCours, setStructureEnCours] = useState(false);
  const [aRecadrer, setARecadrer] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const grille = useRef<HTMLUListElement>(null);
  const enLigne = useEnLigne();
  const actif = enLigne && !structureEnCours;

  const navigate = useNavigate();
  const location = useLocation();
  const [parametres, setParametres] = useSearchParams();

  const interieures = etat.doublesPages.filter((d) => d.role === "interieur");
  const courante =
    interieures.find((d) => d.id === parametres.get("page")) ??
    interieures[0] ??
    null;

  function choisirPage(doublePageId: string | null) {
    setParametres(
      (actuels) => {
        const suivants = new URLSearchParams(actuels);
        if (doublePageId) suivants.set("page", doublePageId);
        else suivants.delete("page");
        return suivants;
      },
      { replace: true },
    );
    dispatch({ type: "selectionner", emplacementId: null });
  }

  async function relire() {
    try {
      dispatch({
        type: "remplacerDoublesPages",
        doublesPages: await listerDoublesPages(projetId),
      });
    } catch (erreur) {
      traiterErreur(erreur);
    }
  }

  // Session expirée : retour à la connexion sans perdre l'adresse demandée, comme sousSession.
  function traiterErreur(erreur: unknown) {
    if (erreur instanceof ErreurNonAuthentifie) {
      void navigate(
        `/connexion?retour=${encodeURIComponent(location.pathname + location.search)}`,
      );
    } else if (erreur instanceof ErreurBase && erreur.code === "23503") {
      // La clé étrangère refuse une photo supprimée dans un autre onglet.
      setMessage("Cette photo n'est plus dans le livre.");
      void relire();
    } else if (erreur instanceof ErreurBase && erreur.code === "introuvable") {
      setMessage("Cette double page n'existe plus.");
      void relire();
    } else if (erreur instanceof ErreurReseau) {
      setMessage(
        "Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.",
      );
    } else {
      setMessage("La modification a été refusée.");
    }
  }
  const traiterErreurCourante = useRef(traiterErreur);
  useEffect(() => {
    traiterErreurCourante.current = traiterErreur;
  });

  // Une seule file pour la vie de l'écran, créée au premier geste.
  const fileCourante = useRef<FileEcritures | null>(null);
  function file(): FileEcritures {
    fileCourante.current ??= creerFileEcritures({
      surStatut: setStatut,
      surEchec: (erreur) => traiterErreurCourante.current(erreur),
    });
    return fileCourante.current;
  }

  // Un geste sur un emplacement : appliqué tout de suite, écrit tel qu'affiché, rétabli si refusé.
  function geste(emplacementId: string, action: ActionEditeur) {
    const suivant = reduireEditeur(etatCourant.current, action);
    const avant = emplacementDe(etatCourant.current, emplacementId);
    const apres = emplacementDe(suivant, emplacementId);
    if (!avant || !apres) return;
    etatCourant.current = suivant;
    setMessage(null);
    file().ajouter({
      appliquer: () => dispatch(action),
      ecrire: () => ecrireEmplacement(apres),
      retablir: () => dispatch({ type: "retablir", emplacement: avant }),
    });
  }

  const poser = (emplacementId: string, photoId: string) =>
    geste(emplacementId, { type: "poser", emplacementId, photoId });
  const vider = (emplacementId: string) =>
    geste(emplacementId, { type: "vider", emplacementId });

  // Un geste de structure attend la fin des écritures en cours, appelle la fonction SQL,
  // puis relit les doubles pages. L'opération renvoie la page courante une fois le geste fait.
  async function modifierStructure(
    operation: () => Promise<string | null>,
  ): Promise<void> {
    setStructureEnCours(true);
    setMessage(null);
    await file().terminer();
    try {
      choisirPage(await operation());
    } catch (erreur) {
      traiterErreur(erreur);
    }
    await relire();
    setStructureEnCours(false);
  }

  function ajouter() {
    if (!gabaritParDefautId) return;
    const gabaritId = gabaritParDefautId;
    void modifierStructure(() =>
      insererDoublePage(projetId, gabaritId, (courante?.position ?? 0) + 1),
    );
  }

  function deplacer(doublePageId: string, position: number) {
    void modifierStructure(async () => {
      await deplacerDoublePage(doublePageId, position);
      return doublePageId;
    });
  }

  function dupliquer(doublePageId: string) {
    void modifierStructure(() => dupliquerDoublePage(doublePageId));
  }

  // Après une suppression, la page courante devient la suivante, sinon la précédente.
  function supprimer(doublePageId: string) {
    const rang = interieures.findIndex((d) => d.id === doublePageId);
    const voisine =
      interieures[rang + 1]?.id ?? interieures[rang - 1]?.id ?? null;
    setASupprimer(null);
    void modifierStructure(async () => {
      await supprimerDoublePage(doublePageId);
      return voisine;
    });
  }

  const photosAffichees = new Map<string, PhotoAffichee>(
    photos.map((photo) => [photo.id, photo]),
  );
  const posees = new Set(
    etat.doublesPages.flatMap((d) =>
      d.emplacement.flatMap((e) => (e.photo_id ? [e.photo_id] : [])),
    ),
  );
  const selection =
    etat.selection && courante
      ? courante.emplacement.find((e) => e.id === etat.selection)
      : undefined;
  const recadree = aRecadrer ? emplacementDe(etat, aRecadrer) : undefined;
  const photoRecadree = recadree?.photo_id
    ? photosAffichees.get(recadree.photo_id)
    : undefined;

  const interaction: InteractionDoublePage | undefined = actif
    ? {
        selection: etat.selection,
        surSelection: (emplacementId) =>
          dispatch({ type: "selectionner", emplacementId }),
        surDepot: poser,
        surRecadrer: setARecadrer,
        surVider: vider,
      }
    : undefined;

  return (
    <section className={styles.editeur} aria-labelledby="titre-livre">
      <div className={styles.enteteLivre}>
        <h2 id="titre-livre">Livre</h2>
        <div className={styles.statut} role="status">
          <span
            className={[styles.pastilleStatut, styles[statut]].join(" ")}
            aria-hidden="true"
          />
          {LIBELLES_STATUT[statut]}
          {statut === "echec" && (
            <Bouton
              variante="tertiaire"
              taille="petit"
              disabled={!enLigne}
              onClick={() => file().reessayer()}
            >
              Réessayer
            </Bouton>
          )}
        </div>
        <div className={styles.actionsLivre}>{actionsLivre}</div>
      </div>
      {!enLigne && (
        <Banniere titre="Hors-ligne">
          Les modifications reprendront au retour de la connexion.
        </Banniere>
      )}
      {message && <Banniere titre={message} />}

      <div className={styles.espaceTravail}>
        <div className={styles.planDeTravail}>
          {courante ? (
            <>
              <div
                className={styles.barreOutils}
                aria-label="Cadre sélectionné"
              >
                {selection ? (
                  <>
                    <Bouton
                      variante="secondaire"
                      taille="petit"
                      disabled={!actif || !selection.photo_id}
                      onClick={() => setARecadrer(selection.id)}
                    >
                      Recadrer
                    </Bouton>
                    <Bouton
                      variante="secondaire"
                      taille="petit"
                      disabled={!actif || photos.length === 0}
                      onClick={() =>
                        grille.current
                          ?.querySelector<HTMLElement>("[role=button]")
                          ?.focus()
                      }
                    >
                      Remplacer
                    </Bouton>
                    <Bouton
                      variante="secondaire"
                      taille="petit"
                      disabled={!actif || !selection.photo_id}
                      onClick={() => vider(selection.id)}
                    >
                      Vider
                    </Bouton>
                  </>
                ) : (
                  <p className={styles.aide}>
                    Glissez une photo de la réserve sur un cadre, ou
                    sélectionnez un cadre puis choisissez la photo.
                  </p>
                )}
              </div>
              <div className={styles.pageCourante}>
                <DoublePage
                  doublePage={courante}
                  fond={fond}
                  photos={photosAffichees}
                  interaction={interaction}
                />
              </div>
            </>
          ) : (
            <p className={styles.invitation}>
              Ce livre n'a pas encore de double page intérieure. Composez le
              livre avec vos photos, ou ajoutez une double page.
            </p>
          )}
          <BandeDoublesPages
            interieures={interieures}
            courante={courante}
            fond={fond}
            photos={photosAffichees}
            actif={actif}
            peutAjouter={gabaritParDefautId !== null}
            surChoisir={choisirPage}
            surAjouter={ajouter}
            surDeplacer={deplacer}
            surDupliquer={dupliquer}
            surSupprimer={setASupprimer}
          />
        </div>

        <Reserve
          photos={photos}
          posees={posees}
          cadreSelectionne={Boolean(selection)}
          actif={actif}
          surChoisir={(photoId) => selection && poser(selection.id, photoId)}
          surSupprimer={surSupprimerPhoto}
          surImporter={surImporter}
          refGrille={grille}
        />
      </div>

      {recadree && photoRecadree && (
        <SurcoucheRecadrage
          emplacement={recadree}
          photo={photoRecadree}
          surFermer={() => setARecadrer(null)}
          surValider={(cadrage) => {
            setARecadrer(null);
            geste(recadree.id, {
              type: "recadrer",
              emplacementId: recadree.id,
              cadrage,
            });
          }}
        />
      )}
      {aSupprimer && (
        <Modale
          titre="Supprimer cette double page ?"
          onFermer={() => setASupprimer(null)}
        >
          <div className={styles.formulaire}>
            <p>
              Les photos qui y sont posées restent dans la réserve. Cette action
              est définitive.
            </p>
            <div className={styles.boutonsModale}>
              {/* Le choix sans risque a le focus : Entrée par réflexe ne supprime rien. */}
              <Bouton
                variante="secondaire"
                onClick={() => setASupprimer(null)}
                autoFocus
              >
                Annuler
              </Bouton>
              <Bouton
                variante="destructif"
                onClick={() => supprimer(aSupprimer)}
              >
                Supprimer
              </Bouton>
            </div>
          </div>
        </Modale>
      )}
    </section>
  );
}
