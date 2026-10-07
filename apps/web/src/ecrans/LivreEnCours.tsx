import {
  data,
  Link,
  type LoaderFunctionArgs,
  Outlet,
  useLoaderData,
  useNavigate,
} from "react-router";
import { z } from "zod";
import { listerPhotos, lireProjet, urlsDesVignettes } from "../api/photos";
import { Bouton } from "../composants/Bouton";
import { EtatVide } from "../composants/EtatVide";
import { sousSession } from "../session";
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
    return {
      projet,
      photos: photos.map((photo) => ({ ...photo, url: urls.get(photo.id) })),
    };
  });
}

function compteDePhotos(nombre: number): string {
  return nombre === 1 ? "1 photo" : `${nombre} photos`;
}

// E7, réduit pour l'instant à la réserve : les photos du livre, pas encore posées.
// L'import (E5) s'ouvre par-dessus, à sa propre adresse.
export function LivreEnCours() {
  const { projet, photos } = useLoaderData<typeof chargerLivreEnCours>();
  const navigate = useNavigate();
  const ouvrirImport = () => void navigate("import");

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
              </li>
            ))}
          </ul>
        )}
      </section>
      <Outlet />
    </>
  );
}
