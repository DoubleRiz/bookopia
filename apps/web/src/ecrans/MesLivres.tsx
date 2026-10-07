import { useCallback, useEffect, useState } from "react";
import {
  type ActionFunctionArgs,
  Link,
  type LoaderFunctionArgs,
  Outlet,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "react-router";
import { renommerProjetSchema } from "@bookopia/shared";
import { ErreurBase } from "../api/client";
import {
  listerProjets,
  type ResumeProjet,
  renommerProjet,
  supprimerProjet,
} from "../api/projets";
import { Bouton } from "../composants/Bouton";
import { Champ } from "../composants/Champ";
import { EtatVide } from "../composants/EtatVide";
import { Modale } from "../composants/Modale";
import { Squelette } from "../composants/Squelette";
import {
  erreurDeFormulaire,
  erreursDeValidation,
  type ResultatFormulaire,
  sousSession,
  texteDuChamp,
} from "../session";
import styles from "./MesLivres.module.css";
import { NouveauLivreEnChargement } from "./NouveauLivre";

export async function chargerMesLivres({ request }: LoaderFunctionArgs) {
  return sousSession(request, listerProjets);
}

type ResultatAction = ResultatFormulaire & { reussi?: true };

// Les deux écritures de la liste passent par la même route, distinguées par le champ intention.
export async function actionMesLivres({
  request,
}: ActionFunctionArgs): Promise<ResultatAction> {
  return sousSession(request, async () => {
    const donnees = await request.formData();
    const intention = texteDuChamp(donnees, "intention");
    const projetId = texteDuChamp(donnees, "projetId");

    try {
      if (intention === "renommer") {
        const entree = renommerProjetSchema.safeParse({
          titre: texteDuChamp(donnees, "titre"),
        });
        if (!entree.success) {
          return erreursDeValidation(entree.error);
        }
        await renommerProjet(projetId, entree.data);
      } else if (intention === "supprimer") {
        await supprimerProjet(projetId);
      } else {
        throw new Error(`Intention inconnue : ${intention}`);
      }
    } catch (erreur) {
      if (erreur instanceof ErreurBase && erreur.code === "introuvable") {
        return { message: "Ce livre n'existe plus. Rechargez la page." };
      }
      return erreurDeFormulaire(erreur);
    }
    return { reussi: true };
  });
}

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

function compteDeLivres(nombre: number): string {
  return nombre === 1 ? "1 livre" : `${nombre} livres`;
}

type Demande = { action: "renommer" | "supprimer"; projet: ResumeProjet };

function LigneLivre({
  projet,
  onDemander,
}: {
  projet: ResumeProjet;
  onDemander: (demande: Demande) => void;
}) {
  return (
    <li className={styles.livre}>
      <div className={styles.vignette} aria-hidden="true">
        <div className={styles.page} />
      </div>
      <div className={styles.infos}>
        <div className={styles.ligneTitre}>
          <Link to={`/livre/${projet.id}`} className={styles.nomLivre}>
            {projet.titre}
          </Link>
          {/* L'intention du Créateur, en contour : le badge plein est réservé à l'avancement calculé. */}
          <span className={styles.intention}>
            {projet.brouillon ? "Brouillon" : "Terminé"}
          </span>
        </div>
        <span className={styles.meta}>
          Modifié le {FORMAT_DATE.format(new Date(projet.modifie_le))}
        </span>
        <div className={styles.actions}>
          <Bouton
            variante="secondaire"
            taille="petit"
            aria-label={`Renommer « ${projet.titre} »`}
            onClick={() => onDemander({ action: "renommer", projet })}
          >
            Renommer
          </Bouton>
          <Bouton
            variante="secondaire"
            taille="petit"
            aria-label={`Supprimer « ${projet.titre} »`}
            onClick={() => onDemander({ action: "supprimer", projet })}
          >
            Supprimer
          </Bouton>
        </div>
      </div>
    </li>
  );
}

// La modale se ferme d'elle-même quand l'écriture a réussi ; en cas d'échec, elle reste ouverte
// avec le message.
function useEcriture(onFermer: () => void) {
  const fetcher = useFetcher<typeof actionMesLivres>();
  const reussi = fetcher.state === "idle" && fetcher.data?.reussi;
  useEffect(() => {
    if (reussi) onFermer();
  }, [reussi, onFermer]);
  return fetcher;
}

function ModaleRenommer({
  projet,
  onFermer,
}: {
  projet: ResumeProjet;
  onFermer: () => void;
}) {
  const fetcher = useEcriture(onFermer);
  return (
    <Modale titre="Renommer le livre" onFermer={onFermer}>
      <fetcher.Form
        method="post"
        action="/livres"
        className={styles.formulaire}
      >
        <input type="hidden" name="intention" value="renommer" />
        <input type="hidden" name="projetId" value={projet.id} />
        {fetcher.data?.message && (
          <p className={styles.erreurGlobale} role="alert">
            {fetcher.data.message}
          </p>
        )}
        <Champ
          libelle="Titre du livre"
          name="titre"
          defaultValue={projet.titre}
          erreurs={
            fetcher.data?.champs?.titre && ["Le titre ne peut pas être vide"]
          }
          autoFocus
          autoComplete="off"
          onFocus={(evenement) => evenement.currentTarget.select()}
        />
        <div className={styles.boutonsModale}>
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton type="submit" enCours={fetcher.state !== "idle"}>
            Renommer
          </Bouton>
        </div>
      </fetcher.Form>
    </Modale>
  );
}

function ModaleSupprimer({
  projet,
  onFermer,
}: {
  projet: ResumeProjet;
  onFermer: () => void;
}) {
  const fetcher = useEcriture(onFermer);
  return (
    <Modale titre={`Supprimer « ${projet.titre} » ?`} onFermer={onFermer}>
      <fetcher.Form
        method="post"
        action="/livres"
        className={styles.formulaire}
      >
        <input type="hidden" name="intention" value="supprimer" />
        <input type="hidden" name="projetId" value={projet.id} />
        {fetcher.data?.message && (
          <p className={styles.erreurGlobale} role="alert">
            {fetcher.data.message}
          </p>
        )}
        <p>
          Ses doubles pages, ses photos et ses exports sont supprimés. Cette
          action est définitive.
        </p>
        <div className={styles.boutonsModale}>
          {/* Le choix sans risque a le focus : Entrée par réflexe ne supprime rien. */}
          <Bouton
            type="button"
            variante="secondaire"
            onClick={onFermer}
            autoFocus
          >
            Annuler
          </Bouton>
          <Bouton
            type="submit"
            variante="destructif"
            enCours={fetcher.state !== "idle"}
          >
            Supprimer
          </Bouton>
        </div>
      </fetcher.Form>
    </Modale>
  );
}

// E4. La création (S1) s'ouvre par-dessus, à sa propre adresse.
export function MesLivres() {
  const projets = useLoaderData<typeof chargerMesLivres>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [demande, setDemande] = useState<Demande | null>(null);
  // Stable : la modale s'en sert dans un effet.
  const fermer = useCallback(() => setDemande(null), []);

  const nouveauEnChargement =
    navigation.state === "loading" &&
    navigation.location.pathname === "/livres/nouveau";
  const ouvrirCreation = () => void navigate("/livres/nouveau");

  return (
    <>
      <div className={styles.entete}>
        <div className={styles.titre}>
          <h1>Mes livres</h1>
          {projets.length > 0 && (
            <span className={styles.compte}>
              {compteDeLivres(projets.length)}
            </span>
          )}
        </div>
        {projets.length > 0 && (
          <Bouton onClick={ouvrirCreation}>Nouveau livre</Bouton>
        )}
      </div>
      {projets.length === 0 ? (
        <EtatVide
          titre="Aucun livre pour l'instant"
          action={
            <Bouton onClick={ouvrirCreation}>Créer mon premier livre</Bouton>
          }
        >
          Vos livres apparaîtront ici, du plus récemment modifié au plus ancien.
        </EtatVide>
      ) : (
        <ul className={styles.liste}>
          {projets.map((projet) => (
            <LigneLivre
              key={projet.id}
              projet={projet}
              onDemander={setDemande}
            />
          ))}
        </ul>
      )}
      {demande?.action === "renommer" && (
        <ModaleRenommer projet={demande.projet} onFermer={fermer} />
      )}
      {demande?.action === "supprimer" && (
        <ModaleSupprimer projet={demande.projet} onFermer={fermer} />
      )}
      {nouveauEnChargement ? <NouveauLivreEnChargement /> : <Outlet />}
    </>
  );
}

// Même forme que la liste : le contenu ne saute pas quand les données arrivent.
export function MesLivresEnChargement() {
  return (
    <>
      <div className={styles.titre}>
        <h1>Mes livres</h1>
        <Squelette largeur="80px" hauteur="14px" />
      </div>
      <ul className={styles.liste}>
        {[0, 1, 2].map((rang) => (
          <li key={rang} className={styles.livre}>
            <Squelette largeur="100%" hauteur="96px" rayon="12px" />
            <div className={styles.infos}>
              <Squelette largeur="40%" hauteur="20px" />
              <Squelette largeur="25%" hauteur="14px" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
