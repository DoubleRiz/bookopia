import { type LoaderFunctionArgs, useLoaderData } from "react-router";
import type { ResumeProjet } from "@bookopia/shared";
import { listerProjets } from "../api/projets";
import { EtatVide } from "../composants/EtatVide";
import { Squelette } from "../composants/Squelette";
import { sousSession } from "../session";
import styles from "./MesLivres.module.css";

export async function chargerMesLivres({ request }: LoaderFunctionArgs) {
  return sousSession(request, listerProjets);
}

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

function compteDeLivres(nombre: number): string {
  return nombre === 1 ? "1 livre" : `${nombre} livres`;
}

function LigneLivre({ projet }: { projet: ResumeProjet }) {
  return (
    <li className={styles.livre}>
      <div className={styles.vignette} aria-hidden="true">
        <div className={styles.page} />
      </div>
      <div className={styles.infos}>
        <div className={styles.ligneTitre}>
          <span className={styles.nomLivre}>{projet.titre}</span>
          {/* L'intention du Créateur, en contour : le badge plein est réservé à l'avancement calculé. */}
          <span className={styles.intention}>
            {projet.brouillon ? "Brouillon" : "Terminé"}
          </span>
        </div>
        <span className={styles.meta}>
          Modifié le {FORMAT_DATE.format(new Date(projet.modifieLe))}
        </span>
      </div>
    </li>
  );
}

// E4. Le catalogue de modèles et la création (S1) arrivent avec l'étape CRUD projet.
export function MesLivres() {
  const projets = useLoaderData<typeof chargerMesLivres>();

  return (
    <>
      <div className={styles.titre}>
        <h1>Mes livres</h1>
        {projets.length > 0 && (
          <span className={styles.compte}>
            {compteDeLivres(projets.length)}
          </span>
        )}
      </div>
      {projets.length === 0 ? (
        <EtatVide titre="Aucun livre pour l'instant">
          Vos livres apparaîtront ici, du plus récemment modifié au plus ancien.
        </EtatVide>
      ) : (
        <ul className={styles.liste}>
          {projets.map((projet) => (
            <LigneLivre key={projet.id} projet={projet} />
          ))}
        </ul>
      )}
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
