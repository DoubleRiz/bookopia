import {
  type ReactNode,
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  useLocation,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from "react-router";
import { ErreurBase, ErreurNonAuthentifie, ErreurReseau } from "../api/client";
import type { GabaritAComposer } from "@bookopia/shared";
import {
  changerGabarit,
  type DoublePageDuLivre,
  deplacerDoublePage,
  dupliquerDoublePage,
  type EmplacementDuLivre,
  ecrireEmplacement,
  insererDoublePage,
  listerDoublesPages,
  supprimerDoublePage,
} from "../api/doublesPages";
import { changerTheme, type ThemeDuCatalogue } from "../api/themes";
import { Banniere } from "../composants/Banniere";
import { BarreLivre } from "../composants/BarreLivre";
import { Bouton, LienBouton } from "../composants/Bouton";
import {
  DoublePage,
  type Habillage,
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
import { gabaritParDefaut } from "./gabaritParDefaut";
import {
  annuler,
  enregistrer,
  type Historique,
  HISTORIQUE_VIDE,
  refaire,
} from "./historique";
import { type PhotoDeReserve, Reserve } from "./Reserve";
import { SaisieTexte } from "./SaisieTexte";
import { SurcoucheGabarits } from "./SurcoucheGabarits";
import { SurcoucheRecadrage } from "./SurcoucheRecadrage";
import { SurcoucheThemes } from "./SurcoucheThemes";

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

// Une saisie part en base après une pause de la frappe, et tout de suite à sa fin.
const DELAI_ECRITURE_TEXTE_MS = 600;

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
  titre,
  habillage,
  themes,
  themeActuel,
  doublesPages,
  photos,
  gabarits,
  actionsLivre,
  surImporter,
  surSupprimerPhoto,
}: {
  projetId: string;
  titre: string;
  habillage: Habillage;
  // Les thèmes proposés ; vide si le catalogue est illisible.
  themes: ThemeDuCatalogue[];
  themeActuel: { id: string; nom: string };
  doublesPages: DoublePageDuLivre[];
  photos: Photo[];
  // Intérieurs actifs de la famille du livre ; vide si le catalogue est illisible.
  gabarits: GabaritAComposer[];
  actionsLivre: ReactNode;
  surImporter: () => void;
  surSupprimerPhoto: (photo: PhotoDeReserve) => void;
}) {
  const [etat, dispatch] = useReducer(
    reduireEditeur,
    doublesPages,
    etatInitial,
  );
  // L'historique d'annulation, lu par les gestes et par le clavier comme l'état.
  const [historique, setHistorique] = useReducer(
    (_: Historique, suivant: Historique) => suivant,
    HISTORIQUE_VIDE,
  );
  const historiqueCourant = useRef(historique);
  function changerHistorique(suivant: Historique) {
    historiqueCourant.current = suivant;
    setHistorique(suivant);
  }

  // Le loader repasse après une composition, un import ou une suppression de photo.
  useEffect(() => {
    dispatch({ type: "remplacerDoublesPages", doublesPages });
    changerHistorique(HISTORIQUE_VIDE);
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
  const [choixGabarit, setChoixGabarit] = useState(false);
  const [choixTheme, setChoixTheme] = useState(false);
  const [enSaisie, setEnSaisie] = useState<string | null>(null);
  const revalidator = useRevalidator();
  const grille = useRef<HTMLUListElement>(null);
  const enLigne = useEnLigne();
  const actif = enLigne && !structureEnCours;

  const navigate = useNavigate();
  const location = useLocation();
  const [parametres, setParametres] = useSearchParams();

  const interieures = etat.doublesPages.filter((d) => d.role === "interieur");
  const couverture = etat.doublesPages.find((d) => d.role === "couverture");
  const quatrieme = etat.doublesPages.find((d) => d.role === "quatrieme");
  // Par défaut la première intérieure ; sans intérieure, la couverture.
  const courante =
    etat.doublesPages.find((d) => d.id === parametres.get("page")) ??
    interieures[0] ??
    couverture ??
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
    changerHistorique(HISTORIQUE_VIDE);
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
    changerHistorique(enregistrer(historiqueCourant.current, { avant, apres }));
    file().ajouter({
      appliquer: () => dispatch(action),
      ecrire: () => ecrireEmplacement(apres),
      retablir: () => {
        // Un geste refusé laisse l'historique incertain : on repart de zéro.
        changerHistorique(HISTORIQUE_VIDE);
        dispatch({ type: "retablir", emplacement: avant });
      },
    });
  }

  // Annuler et refaire écrivent l'état visé comme n'importe quel geste : affiché tout de suite,
  // écrit par la file, rétabli si la base refuse.
  function rejouer(
    resultat: ReturnType<typeof annuler>,
    emplacementAvant: (id: string) => EmplacementDuLivre | undefined,
  ) {
    if (!resultat) return;
    const cible = resultat.cible;
    const avant = emplacementAvant(cible.id);
    if (!avant) {
      changerHistorique(HISTORIQUE_VIDE);
      return;
    }
    const action: ActionEditeur = { type: "retablir", emplacement: cible };
    etatCourant.current = reduireEditeur(etatCourant.current, action);
    setMessage(null);
    changerHistorique(resultat.historique);
    file().ajouter({
      appliquer: () => dispatch(action),
      ecrire: () => ecrireEmplacement(cible),
      retablir: () => {
        changerHistorique(HISTORIQUE_VIDE);
        dispatch({ type: "retablir", emplacement: avant });
      },
    });
  }

  function annulerGeste() {
    rejouer(annuler(historiqueCourant.current), (id) =>
      emplacementDe(etatCourant.current, id),
    );
  }

  function refaireGeste() {
    rejouer(refaire(historiqueCourant.current), (id) =>
      emplacementDe(etatCourant.current, id),
    );
  }

  const poser = (emplacementId: string, photoId: string) =>
    geste(emplacementId, { type: "poser", emplacementId, photoId });
  const vider = (emplacementId: string) =>
    geste(emplacementId, { type: "vider", emplacementId });

  // La saisie d'un texte : chaque frappe s'affiche, l'écriture part après une pause.
  // Refusée, elle rétablit le dernier texte enregistré, pas celui d'avant la frappe.
  const texteEnregistre = useRef<EmplacementDuLivre | null>(null);
  const minuterieTexte = useRef<number | undefined>(undefined);

  function ouvrirSaisie(emplacementId: string) {
    texteEnregistre.current =
      emplacementDe(etatCourant.current, emplacementId) ?? null;
    dispatch({ type: "selectionner", emplacementId });
    setEnSaisie(emplacementId);
  }

  function enregistrerTexte() {
    window.clearTimeout(minuterieTexte.current);
    const avant = texteEnregistre.current;
    const apres = avant && emplacementDe(etatCourant.current, avant.id);
    if (!avant || !apres || apres.contenu_texte === avant.contenu_texte) return;
    texteEnregistre.current = apres;
    changerHistorique(enregistrer(historiqueCourant.current, { avant, apres }));
    file().ajouter({
      appliquer: () => {},
      ecrire: () => ecrireEmplacement(apres),
      retablir: () => {
        changerHistorique(HISTORIQUE_VIDE);
        texteEnregistre.current = avant;
        dispatch({ type: "retablir", emplacement: avant });
      },
    });
  }

  function ecrireTexte(emplacementId: string, contenu: string) {
    const action: ActionEditeur = {
      type: "ecrireTexte",
      emplacementId,
      contenu,
    };
    etatCourant.current = reduireEditeur(etatCourant.current, action);
    dispatch(action);
    setMessage(null);
    window.clearTimeout(minuterieTexte.current);
    minuterieTexte.current = window.setTimeout(
      enregistrerTexte,
      DELAI_ECRITURE_TEXTE_MS,
    );
  }

  function fermerSaisie() {
    enregistrerTexte();
    setEnSaisie(null);
  }

  // Un geste de structure attend la fin des écritures en cours, appelle la fonction SQL,
  // puis relit les doubles pages. L'opération renvoie la page courante une fois le geste fait.
  async function modifierStructure(
    operation: () => Promise<string | null>,
  ): Promise<void> {
    setStructureEnCours(true);
    setMessage(null);
    changerHistorique(HISTORIQUE_VIDE);
    await file().terminer();
    try {
      choisirPage(await operation());
    } catch (erreur) {
      traiterErreur(erreur);
    }
    await relire();
    setStructureEnCours(false);
  }

  // Le thème habille tout le livre : rien n'est perdu, la page courante ne change pas.
  // Le loader repasse ensuite, avec les polices du nouveau thème.
  async function appliquerTheme(themeId: string) {
    setChoixTheme(false);
    setStructureEnCours(true);
    setMessage(null);
    changerHistorique(HISTORIQUE_VIDE);
    await file().terminer();
    try {
      await changerTheme(projetId, themeId);
    } catch (erreur) {
      if (erreur instanceof ErreurBase && erreur.code === "invalide") {
        setMessage("Ce thème n'est plus proposé.");
      } else {
        traiterErreur(erreur);
      }
    }
    await revalidator.revalidate();
    setStructureEnCours(false);
  }

  const gabaritParDefautId = gabaritParDefaut(gabarits)?.id ?? null;

  // Une double page s'insère après la courante ; depuis la couverture, en tête, depuis la 4e, en fin.
  function ajouter() {
    if (!gabaritParDefautId) return;
    const gabaritId = gabaritParDefautId;
    const position =
      courante?.role === "interieur"
        ? (courante.position ?? 0) + 1
        : courante?.role === "quatrieme"
          ? interieures.length + 1
          : 1;
    void modifierStructure(() =>
      insererDoublePage(projetId, gabaritId, position),
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

  // Les cadres sont recréés vides ; la page courante reste la même, la sélection disparaît.
  function appliquerGabarit(doublePageId: string, gabaritId: string) {
    setChoixGabarit(false);
    void modifierStructure(async () => {
      await changerGabarit(doublePageId, gabaritId);
      return doublePageId;
    });
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

  // Les cartes du choix de thème montrent la page courante.
  const apercuTheme = courante;

  const saisie =
    enSaisie && courante
      ? courante.emplacement.find((e) => e.id === enSaisie)
      : undefined;
  const saisieOuverte =
    saisie?.style_texte && habillage.mesures
      ? { ...saisie, style_texte: saisie.style_texte }
      : undefined;

  // Ctrl Z annule, Ctrl Maj Z (ou Ctrl Y) refait. Dans un champ, Ctrl Z reste celui du champ.
  const raccourciCourant = useRef<(evenement: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    raccourciCourant.current = (evenement) => {
      if (!actif || !(evenement.ctrlKey || evenement.metaKey)) return;
      const cible = evenement.target;
      if (
        cible instanceof HTMLElement &&
        (cible.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName))
      )
        return;
      const touche = evenement.key.toLowerCase();
      if (touche === "z" && !evenement.shiftKey) annulerGeste();
      else if ((touche === "z" && evenement.shiftKey) || touche === "y")
        refaireGeste();
      else return;
      evenement.preventDefault();
    };
  });
  useEffect(() => {
    const ecouter = (evenement: KeyboardEvent) =>
      raccourciCourant.current(evenement);
    window.addEventListener("keydown", ecouter);
    return () => window.removeEventListener("keydown", ecouter);
  }, []);

  const interaction: InteractionDoublePage | undefined = actif
    ? {
        selection: etat.selection,
        enSaisie: saisieOuverte?.id ?? null,
        surSaisir: ouvrirSaisie,
        surSelection: (emplacementId) =>
          dispatch({ type: "selectionner", emplacementId }),
        surDepot: poser,
        surRecadrer: setARecadrer,
        surVider: vider,
      }
    : undefined;

  return (
    <section className={styles.editeur} aria-label="Éditeur du livre">
      <BarreLivre
        retour={{ vers: "/livres", libelle: "Mes livres" }}
        titre={titre}
        statut={
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
        }
        etape="composer"
        importFait={photos.length > 0}
        actions={
          photos.length > 0 && (
            <>
              <Bouton variante="secondaire" onClick={surImporter}>
                Importer des photos
              </Bouton>
              <LienBouton vers="export">Vérifier et exporter</LienBouton>
            </>
          )
        }
      />
      <div className={styles.outilsLivre}>
        <Bouton
          variante="tertiaire"
          disabled={!actif || historique.passe.length === 0}
          onClick={annulerGeste}
        >
          Annuler
        </Bouton>
        <Bouton
          variante="tertiaire"
          disabled={!actif || historique.futur.length === 0}
          onClick={refaireGeste}
        >
          Refaire
        </Bouton>
        <Bouton
          variante="secondaire"
          disabled={!actif || themes.length < 2}
          onClick={() => setChoixTheme(true)}
        >
          Thème · {themeActuel.nom}
        </Bouton>
        {actionsLivre}
      </div>
      {!enLigne && (
        <Banniere titre="Hors-ligne">
          Les modifications reprendront au retour de la connexion.
        </Banniere>
      )}
      {message && <Banniere titre={message} />}

      <div className={styles.espaceTravail}>
        <BandeDoublesPages
          couverture={couverture}
          quatrieme={quatrieme}
          interieures={interieures}
          courante={courante}
          habillage={habillage}
          photos={photosAffichees}
          actif={actif}
          peutAjouter={gabaritParDefautId !== null}
          peutChangerGabarit={gabarits.length > 1}
          surChoisir={choisirPage}
          surAjouter={ajouter}
          surDeplacer={deplacer}
          surChangerGabarit={() => setChoixGabarit(true)}
          surDupliquer={dupliquer}
          surSupprimer={setASupprimer}
        />
        <div className={styles.planDeTravail}>
          {courante ? (
            <>
              <div
                className={styles.barreOutils}
                aria-label="Cadre sélectionné"
              >
                {selection?.nature === "texte" ? (
                  <Bouton
                    variante="secondaire"
                    taille="petit"
                    disabled={!actif || !habillage.mesures}
                    onClick={() => ouvrirSaisie(selection.id)}
                  >
                    Écrire
                  </Bouton>
                ) : selection ? (
                  <>
                    <Bouton
                      variante="secondaire"
                      taille="petit"
                      className={styles.segmentActif}
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
                    <span className={styles.separateur} aria-hidden="true" />
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
                  habillage={habillage}
                  photos={photosAffichees}
                  interaction={interaction}
                  surcouche={
                    saisieOuverte &&
                    habillage.mesures && (
                      <SaisieTexte
                        key={saisieOuverte.id}
                        emplacement={saisieOuverte}
                        theme={habillage.theme}
                        mesures={habillage.mesures}
                        surChangement={(contenu) =>
                          ecrireTexte(saisieOuverte.id, contenu)
                        }
                        surFin={fermerSaisie}
                      />
                    )
                  }
                />
              </div>
            </>
          ) : (
            <p className={styles.invitation}>
              Ce livre n'a pas encore de double page intérieure. Composez le
              livre avec vos photos, ou ajoutez une double page.
            </p>
          )}
        </div>

        <Reserve
          photos={photos}
          posees={posees}
          cadreSelectionne={selection?.nature === "photo"}
          actif={actif}
          surChoisir={(photoId) =>
            selection?.nature === "photo" && poser(selection.id, photoId)
          }
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
      {choixGabarit && courante && (
        <SurcoucheGabarits
          gabarits={gabarits}
          courante={courante}
          habillage={habillage}
          surChoisir={(gabaritId) => appliquerGabarit(courante.id, gabaritId)}
          surFermer={() => setChoixGabarit(false)}
        />
      )}
      {choixTheme && apercuTheme && (
        <SurcoucheThemes
          themes={themes}
          themeActuelId={themeActuel.id}
          apercu={apercuTheme}
          doublesPages={etat.doublesPages}
          photos={photosAffichees}
          surChoisir={(themeId) => void appliquerTheme(themeId)}
          surFermer={() => setChoixTheme(false)}
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
