import { type DragEvent, useEffect, useId, useState } from "react";
import {
  type LoaderFunctionArgs,
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
  useRouteLoaderData,
} from "react-router";
import { ErreurNonAuthentifie, ErreurReseau } from "../api/client";
import { lireEmpreintes, listerCadresPhoto } from "../api/photos";
import { Bouton } from "../composants/Bouton";
import { Modale } from "../composants/Modale";
import { envoyeur } from "../import/envoyer";
import { filtrer, type Refus, TYPES_ACCEPTES } from "../import/filtrer";
import { oublierJeton } from "../import/google/connexion";
import { ErreurGoogleNonAutorise } from "../import/google/selecteur";
import {
  type Avancement,
  type Echec,
  importer,
  type Source,
  sourceLocale,
} from "../import/importer";
import { calculerEmpreinte, preparateur } from "../import/preparer";
import { sousSession } from "../session";
import styles from "./ImportPhotos.module.css";
import {
  ColonneGooglePhotos,
  type SelectionGoogle,
} from "./ColonneGooglePhotos";
import type { chargerLivreEnCours } from "./LivreEnCours";

export async function chargerImport({ request }: LoaderFunctionArgs) {
  return sousSession(request, listerCadresPhoto);
}

const RAISONS_REFUS: Record<Refus["raison"], string> = {
  format: "Format refusé : JPEG, PNG ou WebP seulement",
  taille: "Plus de 10 Mo",
};

const RAISONS_ECHEC: Record<Echec["raison"], string> = {
  illisible: "Fichier illisible",
  envoi: "Envoi impossible",
  telechargement: "Téléchargement impossible",
  format: RAISONS_REFUS.format,
  taille: RAISONS_REFUS.taille,
};

function pluriel(nombre: number, singulier: string, plurielTexte: string) {
  return `${nombre} ${nombre === 1 ? singulier : plurielTexte}`;
}

type Phase =
  | { nom: "selection" }
  | { nom: "envoi"; avancement: Avancement }
  | { nom: "fin"; bilan: Avancement; videosEcartees: number };

// Un même fichier choisi deux fois (deux glisser-déposer) ne compte qu'une fois dans la sélection.
function cleDeFichier(fichier: File) {
  return `${fichier.name}/${fichier.size}/${fichier.lastModified}`;
}

// E5, surcouche sur E7. Tout se prépare et s'envoie depuis le navigateur : la page doit rester ouverte.
export function ImportPhotos() {
  const cadresPhoto = useLoaderData<typeof chargerImport>();
  const livre = useRouteLoaderData<typeof chargerLivreEnCours>("livre");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { revalidate } = useRevalidator();
  const idChamp = useId();

  const [acceptes, setAcceptes] = useState<File[]>([]);
  const [refuses, setRefuses] = useState<Refus[]>([]);
  const [phase, setPhase] = useState<Phase>({ nom: "selection" });
  const [erreur, setErreur] = useState<string | null>(null);
  const [survol, setSurvol] = useState(false);
  // Remonter la colonne Google annule son attente : un dépôt local prend le pas.
  const [rangGoogle, setRangGoogle] = useState(0);

  const enEnvoi = phase.nom === "envoi";

  // Fermer l'onglet en plein envoi perd la file : le navigateur demande confirmation.
  // Ce qui est déjà arrivé reste, et sera sauté à la reprise grâce aux empreintes.
  useEffect(() => {
    if (!enEnvoi) return;
    const retenir = (evenement: BeforeUnloadEvent) => {
      evenement.preventDefault();
    };
    window.addEventListener("beforeunload", retenir);
    return () => window.removeEventListener("beforeunload", retenir);
  }, [enEnvoi]);

  if (!livre) {
    return null;
  }
  const { projet } = livre;
  const adresseDuLivre = `/livre/${projet.id}`;

  const fermer = () => {
    if (!enEnvoi) void navigate(adresseDuLivre);
  };

  const ajouter = (fichiers: File[]) => {
    const tri = filtrer(fichiers);
    const dejaChoisis = new Set(acceptes.map(cleDeFichier));
    setAcceptes([
      ...acceptes,
      ...tri.acceptes.filter(
        (fichier) => !dejaChoisis.has(cleDeFichier(fichier)),
      ),
    ]);
    setRefuses([...refuses, ...tri.refuses]);
    setErreur(null);
    setRangGoogle((rang) => rang + 1);
  };

  const deposer = (evenement: DragEvent) => {
    evenement.preventDefault();
    setSurvol(false);
    ajouter(Array.from(evenement.dataTransfer.files));
  };

  const lancer = async (
    sources: Source[],
    { videosEcartees = 0, terminer }: Partial<SelectionGoogle> = {},
  ) => {
    const locale = terminer === undefined;
    setErreur(null);
    setPhase({
      nom: "envoi",
      avancement: {
        total: sources.length,
        traites: 0,
        importees: 0,
        doublons: 0,
        echecs: [],
        avertissements: [],
      },
    });
    try {
      const bilan = await importer(
        sources,
        {
          lireEmpreintes: () => lireEmpreintes(projet.id),
          calculerEmpreinte,
          preparer: preparateur(cadresPhoto),
          envoyer: envoyeur(projet.utilisateur_id, projet.id),
        },
        {
          onAvancement: (avancement) => setPhase({ nom: "envoi", avancement }),
        },
      );
      if (locale) {
        setAcceptes([]);
        setRefuses([]);
      }
      setPhase({ nom: "fin", bilan, videosEcartees });
    } catch (probleme) {
      if (probleme instanceof ErreurNonAuthentifie) {
        void navigate(`/connexion?retour=${encodeURIComponent(pathname)}`);
        return;
      }
      setPhase({ nom: "selection" });
      if (probleme instanceof ErreurGoogleNonAutorise) {
        oublierJeton();
        setErreur(
          "Votre accès à Google Photos a expiré. Reconnectez-vous : les photos déjà arrivées seront sautées.",
        );
        return;
      }
      setErreur(
        probleme instanceof ErreurReseau
          ? "Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez : les photos déjà arrivées seront sautées."
          : "L'import n'a pas pu démarrer. Réessayez dans un instant.",
      );
    } finally {
      void terminer?.();
      // La réserve, dessous, montre ce qui est arrivé, même après une interruption.
      void revalidate();
    }
  };

  return (
    <Modale
      large
      titre="Importer des photos"
      sousTitre="JPEG, PNG ou WebP, 10 Mo au plus par photo."
      onFermer={fermer}
    >
      {phase.nom === "selection" && (
        <div className={styles.corps}>
          {erreur && (
            <p className={styles.erreurGlobale} role="alert">
              {erreur}
            </p>
          )}
          <div className={styles.colonnes}>
            <section className={styles.colonne}>
              <h3 className={styles.colonneTitre}>Depuis cet appareil</h3>
              <label
                htmlFor={idChamp}
                className={[styles.zone, survol && styles.survol]
                  .filter(Boolean)
                  .join(" ")}
                onDragOver={(evenement) => {
                  evenement.preventDefault();
                  setSurvol(true);
                }}
                onDragLeave={() => setSurvol(false)}
                onDrop={deposer}
              >
                <span className={styles.zoneTitre}>
                  Glissez vos photos ici, ou cliquez pour les choisir
                </span>
                <span className={styles.zoneAide}>
                  Les photos déjà dans le livre sont sautées.
                </span>
                <input
                  id={idChamp}
                  className={styles.champ}
                  type="file"
                  multiple
                  accept={TYPES_ACCEPTES.join(",")}
                  onChange={(evenement) => {
                    ajouter(Array.from(evenement.currentTarget.files ?? []));
                    evenement.currentTarget.value = "";
                  }}
                />
              </label>
            </section>
            <section className={styles.colonne}>
              <h3 className={styles.colonneTitre}>Depuis Google Photos</h3>
              <ColonneGooglePhotos
                key={rangGoogle}
                onSelection={(selection) =>
                  void lancer(selection.sources, selection)
                }
              />
            </section>
          </div>
          {refuses.length > 0 && (
            <div className={styles.liste}>
              <span className={styles.libelle}>
                {pluriel(refuses.length, "fichier refusé", "fichiers refusés")}
              </span>
              <ul>
                {refuses.map((refus, rang) => (
                  <li key={rang}>
                    <span className={styles.nom}>{refus.nom}</span>
                    <span className={styles.raison}>
                      {RAISONS_REFUS[refus.raison]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={styles.actions}>
            {acceptes.length > 0 && (
              <span className={styles.note}>
                {pluriel(acceptes.length, "photo retenue", "photos retenues")}
              </span>
            )}
            <Bouton type="button" variante="secondaire" onClick={fermer}>
              Annuler
            </Bouton>
            <Bouton
              type="button"
              disabled={acceptes.length === 0}
              onClick={() => void lancer(acceptes.map(sourceLocale))}
            >
              {acceptes.length > 0
                ? `Importer ${pluriel(acceptes.length, "photo", "photos")}`
                : "Importer"}
            </Bouton>
          </div>
        </div>
      )}

      {phase.nom === "envoi" && (
        <div className={styles.corps}>
          <p className={styles.etape} aria-live="polite">
            Envoi {phase.avancement.traites} sur {phase.avancement.total}
          </p>
          <progress
            className={styles.progression}
            max={phase.avancement.total}
            value={phase.avancement.traites}
            aria-label="Avancement de l'import"
          />
          <p className={styles.note}>
            Gardez cette page ouverte : les photos sont préparées par votre
            navigateur.
          </p>
        </div>
      )}

      {phase.nom === "fin" && (
        <Bilan
          bilan={phase.bilan}
          videosEcartees={phase.videosEcartees}
          onRecommencer={() => setPhase({ nom: "selection" })}
          onVoir={() => void navigate(adresseDuLivre)}
        />
      )}
    </Modale>
  );
}

function Bilan({
  bilan,
  videosEcartees,
  onRecommencer,
  onVoir,
}: {
  bilan: Avancement;
  videosEcartees: number;
  onRecommencer: () => void;
  onVoir: () => void;
}) {
  return (
    <div className={styles.corps}>
      <p className={styles.etape} role="status">
        {bilan.importees === 0
          ? "Aucune photo ajoutée"
          : `${pluriel(bilan.importees, "photo ajoutée", "photos ajoutées")} à la réserve`}
      </p>
      {bilan.doublons > 0 && (
        <p>
          {bilan.doublons === 1
            ? "1 photo était déjà dans le livre."
            : `${bilan.doublons} photos étaient déjà dans le livre.`}
        </p>
      )}
      {videosEcartees > 0 && (
        <p>
          {pluriel(videosEcartees, "vidéo écartée", "vidéos écartées")} : non
          prises en charge.
        </p>
      )}
      {bilan.avertissements.length > 0 && (
        <div className={styles.liste}>
          <span className={styles.libelle}>
            Petite taille : risque de flou à l'impression
          </span>
          <ul>
            {bilan.avertissements.map((nom, rang) => (
              <li key={rang}>
                <span className={styles.nom}>{nom}</span>
                <span className={styles.raison}>Moins de 1000 px</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {bilan.echecs.length > 0 && (
        <div className={styles.liste}>
          <span className={styles.libelle}>
            {pluriel(
              bilan.echecs.length,
              "photo non importée",
              "photos non importées",
            )}
          </span>
          <ul>
            {bilan.echecs.map((echec, rang) => (
              <li key={rang}>
                <span className={styles.nom}>{echec.nom}</span>
                <span className={styles.raison}>
                  {RAISONS_ECHEC[echec.raison]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.actions}>
        <Bouton type="button" variante="secondaire" onClick={onRecommencer}>
          Importer d'autres photos
        </Bouton>
        <Bouton type="button" onClick={onVoir} autoFocus>
          Voir la réserve
        </Bouton>
      </div>
    </div>
  );
}
