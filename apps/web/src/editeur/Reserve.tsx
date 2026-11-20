import type { Ref } from "react";
import { Bouton } from "../composants/Bouton";
import { TYPE_GLISSER_PHOTO } from "../composants/DoublePage";
import { EtatVide } from "../composants/EtatVide";
import { Glissable } from "./Glissable";
import styles from "./Editeur.module.css";

export type PhotoDeReserve = {
  id: string;
  nom_fichier_origine: string;
  url?: string;
};

// Plateau ouvert surmonté d'une flèche qui monte : on envoie des photos vers le livre.
function IconeImport() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 15V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

function compteDePhotos(nombre: number): string {
  return nombre === 1 ? "1 photo" : `${nombre} photos`;
}

// Toutes les photos du livre. Une photo déjà posée reste disponible (RG-15), affichée à 45 %.
// Elle se glisse sur un cadre ; au clavier, on sélectionne un cadre puis on choisit la photo ici.
// refGrille désigne la grille : « Remplacer » y place le focus.
// Le titre déplie et replie la réserve ; repliée, elle ne montre plus que son en-tête et l'import.
export function Reserve({
  photos,
  posees,
  cadreSelectionne,
  actif,
  surChoisir,
  surSupprimer,
  surImporter,
  refGrille,
  ouverte,
  surBasculer,
}: {
  photos: PhotoDeReserve[];
  posees: Set<string>;
  cadreSelectionne: boolean;
  actif: boolean;
  surChoisir: (photoId: string) => void;
  surSupprimer: (photo: PhotoDeReserve) => void;
  surImporter: () => void;
  refGrille?: Ref<HTMLUListElement>;
  ouverte: boolean;
  surBasculer: () => void;
}) {
  return (
    <section
      className={[styles.reserve, !ouverte && styles.reserveRepliee]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby="titre-reserve"
    >
      <h2 id="titre-reserve" className={styles.enteteReserve}>
        <button
          type="button"
          className={styles.basculeReserve}
          aria-expanded={ouverte}
          aria-controls="contenu-reserve"
          onClick={surBasculer}
        >
          <span className={styles.chevronReserve} aria-hidden="true" />
          <span className={styles.titreReserve}>Réserve</span>
          {photos.length > 0 && (
            <span className={styles.compte}>
              {compteDePhotos(photos.length)}
            </span>
          )}
        </button>
      </h2>
      {!ouverte && (
        // Repliée, la réserve garde l'import à portée, en icône seule.
        <button
          type="button"
          className={styles.importerRepliee}
          aria-label="Importer des photos"
          title="Importer des photos"
          onClick={surImporter}
        >
          <IconeImport />
        </button>
      )}
      <div
        id="contenu-reserve"
        className={styles.contenuReserve}
        hidden={!ouverte}
      >
        {photos.length > 0 && (
          <Bouton
            variante="secondaire"
            taille="petit"
            className={styles.importerReserve}
            onClick={surImporter}
          >
            <IconeImport />
            Importer des photos
          </Bouton>
        )}
        {photos.length === 0 ? (
          <EtatVide
            titre="Aucune photo pour l'instant"
            action={<Bouton onClick={surImporter}>Importer des photos</Bouton>}
          >
            Les photos importées arrivent ici, avant d'être posées dans le
            livre.
          </EtatVide>
        ) : (
          <ul className={styles.grille} ref={refGrille}>
            {photos.map((photo) => {
              const posee = posees.has(photo.id);
              return (
                <li
                  key={photo.id}
                  className={[styles.vignette, posee && styles.posee]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Glissable
                    className={styles.choisir}
                    actif={actif}
                    aria-label={
                      cadreSelectionne
                        ? `Poser « ${photo.nom_fichier_origine} » dans le cadre sélectionné`
                        : `${photo.nom_fichier_origine}${posee ? ", déjà posée" : ""}`
                    }
                    surDebutGlisser={(evenement) => {
                      evenement.dataTransfer.setData(
                        TYPE_GLISSER_PHOTO,
                        photo.id,
                      );
                      evenement.dataTransfer.effectAllowed = "copy";
                    }}
                    surActiver={() => cadreSelectionne && surChoisir(photo.id)}
                  >
                    {photo.url && (
                      <img
                        src={photo.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    )}
                  </Glissable>
                  {posee && (
                    <span className={styles.badgePosee} aria-hidden="true">
                      Déjà posée
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.supprimer}
                    aria-label={`Supprimer « ${photo.nom_fichier_origine} »`}
                    disabled={!actif}
                    onClick={() => surSupprimer(photo)}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
