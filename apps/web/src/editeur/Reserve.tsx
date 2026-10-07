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

function compteDePhotos(nombre: number): string {
  return nombre === 1 ? "1 photo" : `${nombre} photos`;
}

// Toutes les photos du livre. Une photo déjà posée reste disponible (RG-15), affichée à 45 %.
// Elle se glisse sur un cadre ; au clavier, on sélectionne un cadre puis on choisit la photo ici.
// refGrille désigne la grille : « Remplacer » y place le focus.
export function Reserve({
  photos,
  posees,
  cadreSelectionne,
  actif,
  surChoisir,
  surSupprimer,
  surImporter,
  refGrille,
}: {
  photos: PhotoDeReserve[];
  posees: Set<string>;
  cadreSelectionne: boolean;
  actif: boolean;
  surChoisir: (photoId: string) => void;
  surSupprimer: (photo: PhotoDeReserve) => void;
  surImporter: () => void;
  refGrille?: Ref<HTMLUListElement>;
}) {
  return (
    <section className={styles.reserve} aria-labelledby="titre-reserve">
      <div className={styles.enteteReserve}>
        <h2 id="titre-reserve">Réserve</h2>
        {photos.length > 0 && (
          <span className={styles.compte}>{compteDePhotos(photos.length)}</span>
        )}
      </div>
      {photos.length === 0 ? (
        <EtatVide
          titre="Aucune photo pour l'instant"
          action={<Bouton onClick={surImporter}>Importer des photos</Bouton>}
        >
          Les photos importées arrivent ici, avant d'être posées dans le livre.
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
    </section>
  );
}
