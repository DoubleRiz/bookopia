import { useCallback, useEffect, useState } from "react";
import {
  type ActionFunctionArgs,
  data,
  Link,
  type LoaderFunctionArgs,
  Outlet,
  useFetcher,
  useLoaderData,
  useNavigate,
} from "react-router";
import { z } from "zod";
import { cheminPdf, lireExport, urlDuPdf } from "../api/exports";
import { ErreurBase } from "../api/client";
import {
  listerPhotos,
  lireProjet,
  supprimerPhoto,
  urlsDesVignettes,
} from "../api/photos";
import { Bouton } from "../composants/Bouton";
import { EtatVide } from "../composants/EtatVide";
import { Modale } from "../composants/Modale";
import {
  erreurDeFormulaire,
  type ResultatFormulaire,
  sousSession,
  texteDuChamp,
} from "../session";
import { ExportDuLivre } from "./ExportDuLivre";
import styles from "./LivreEnCours.module.css";

const identifiantSchema = z.uuid();

// Un identifiant mal formé, un livre supprimé ou celui d'un autre : la même réponse, introuvable.
export async function chargerLivreEnCours({
  request,
  params,
}: LoaderFunctionArgs) {
  return sousSession(request, async () => {
    const identifiant = identifiantSchema.safeParse(params.id);
    const projet = identifiant.success
      ? await lireProjet(identifiant.data)
      : null;
    if (!projet) {
      throw data("Livre introuvable", { status: 404 });
    }
    const photos = await listerPhotos(projet.id);
    const urls = await urlsDesVignettes(
      projet.utilisateur_id,
      projet.id,
      photos,
    );
    const pdf = await lireExport(projet.id);
    return {
      projet,
      photos: photos.map((photo) => ({ ...photo, url: urls.get(photo.id) })),
      urlDuPdf: pdf
        ? await urlDuPdf(
            cheminPdf(projet.utilisateur_id, projet.id, pdf.cle_stockage),
            projet.titre,
          )
        : null,
    };
  });
}

type ResultatAction = ResultatFormulaire & { reussi?: true };

// Seule écriture de l'écran pour l'instant : supprimer une photo de la réserve.
// Le loader repasse ensuite, la réserve se met à jour d'elle-même.
export async function actionLivreEnCours({
  request,
}: ActionFunctionArgs): Promise<ResultatAction> {
  return sousSession(request, async () => {
    const donnees = await request.formData();
    try {
      await supprimerPhoto(texteDuChamp(donnees, "photoId"));
    } catch (erreur) {
      if (erreur instanceof ErreurBase && erreur.code === "introuvable") {
        return { message: "Cette photo n'existe plus. Rechargez la page." };
      }
      return erreurDeFormulaire(erreur);
    }
    return { reussi: true };
  });
}

type Photo = Awaited<ReturnType<typeof chargerLivreEnCours>>["photos"][number];

// Surcouche non adressée : la confirmation ne survit pas à un rechargement, c'est voulu.
function ModaleSupprimerPhoto({
  photo,
  onFermer,
}: {
  photo: Photo;
  onFermer: () => void;
}) {
  const fetcher = useFetcher<typeof actionLivreEnCours>();
  const reussi = fetcher.state === "idle" && fetcher.data?.reussi;
  useEffect(() => {
    if (reussi) onFermer();
  }, [reussi, onFermer]);

  return (
    <Modale
      titre={`Supprimer « ${photo.nom_fichier_origine} » ?`}
      onFermer={onFermer}
    >
      <fetcher.Form method="post" className={styles.formulaire}>
        <input type="hidden" name="photoId" value={photo.id} />
        {fetcher.data?.message && (
          <p className={styles.erreurGlobale} role="alert">
            {fetcher.data.message}
          </p>
        )}
        <p>
          La photo quitte la réserve, et les emplacements où elle est posée
          redeviennent vides. Cette action est définitive.
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

function compteDePhotos(nombre: number): string {
  return nombre === 1 ? "1 photo" : `${nombre} photos`;
}

// E7, réduit pour l'instant à la réserve et à un export provisoire.
// L'import (E5) s'ouvre par-dessus, à sa propre adresse.
export function LivreEnCours() {
  const { projet, photos, urlDuPdf } =
    useLoaderData<typeof chargerLivreEnCours>();
  const navigate = useNavigate();
  const ouvrirImport = () => void navigate("import");
  const [aSupprimer, setASupprimer] = useState<Photo | null>(null);
  // Stable : la modale s'en sert dans un effet.
  const fermer = useCallback(() => setASupprimer(null), []);

  return (
    <>
      <div className={styles.entete}>
        <div className={styles.titre}>
          <Link to="/livres" className={styles.retour}>
            ← Mes livres
          </Link>
          <h1>{projet.titre}</h1>
        </div>
        {photos.length > 0 && (
          <Bouton onClick={ouvrirImport}>Importer des photos</Bouton>
        )}
      </div>
      <section className={styles.reserve} aria-labelledby="titre-reserve">
        <div className={styles.enteteReserve}>
          <h2 id="titre-reserve">Réserve</h2>
          {photos.length > 0 && (
            <span className={styles.compte}>
              {compteDePhotos(photos.length)}
            </span>
          )}
        </div>
        {photos.length === 0 ? (
          <EtatVide
            titre="Aucune photo pour l'instant"
            action={<Bouton onClick={ouvrirImport}>Importer des photos</Bouton>}
          >
            Les photos importées arrivent ici, avant d'être posées dans le
            livre.
          </EtatVide>
        ) : (
          <ul className={styles.grille}>
            {photos.map((photo) => (
              <li key={photo.id} className={styles.vignette}>
                {photo.url && (
                  <img
                    src={photo.url}
                    alt={photo.nom_fichier_origine}
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <button
                  type="button"
                  className={styles.supprimer}
                  aria-label={`Supprimer « ${photo.nom_fichier_origine} »`}
                  onClick={() => setASupprimer(photo)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {photos.length > 0 && (
        <ExportDuLivre projet={projet} urlDuPdf={urlDuPdf} />
      )}
      {aSupprimer && (
        <ModaleSupprimerPhoto photo={aSupprimer} onFermer={fermer} />
      )}
      <Outlet />
    </>
  );
}
