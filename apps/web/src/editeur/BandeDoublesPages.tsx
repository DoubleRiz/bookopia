import { type DragEvent, useState } from "react";
import type { DoublePageDuLivre } from "../api/doublesPages";
import { Bouton } from "../composants/Bouton";
import {
  DoublePage,
  libelleDoublePage,
  type PhotoAffichee,
} from "../composants/DoublePage";
import styles from "./Editeur.module.css";
import { Glissable } from "./Glissable";

// Type du glisser-déposer d'une miniature : la donnée transportée est l'identifiant de la double page.
const TYPE_GLISSER_DOUBLE_PAGE = "application/x-bookopia-double-page";

// Les intérieures en miniatures, dans l'ordre du livre. On choisit la page courante, on la
// réordonne en glissant sa miniature, ou par les boutons de la page courante (clavier).
export function BandeDoublesPages({
  interieures,
  courante,
  fond,
  photos,
  actif,
  peutAjouter,
  surChoisir,
  surAjouter,
  surDeplacer,
  surDupliquer,
  surSupprimer,
}: {
  interieures: DoublePageDuLivre[];
  courante: DoublePageDuLivre | null;
  fond: string;
  photos: Map<string, PhotoAffichee>;
  actif: boolean;
  peutAjouter: boolean;
  surChoisir: (doublePageId: string) => void;
  surAjouter: () => void;
  surDeplacer: (doublePageId: string, position: number) => void;
  surDupliquer: (doublePageId: string) => void;
  surSupprimer: (doublePageId: string) => void;
}) {
  const [survolee, setSurvolee] = useState<string | null>(null);
  const rang = courante?.position ?? 0;

  function survol(evenement: DragEvent, doublePageId: string) {
    if (!actif) return;
    if (!evenement.dataTransfer.types.includes(TYPE_GLISSER_DOUBLE_PAGE))
      return;
    evenement.preventDefault();
    evenement.dataTransfer.dropEffect = "move";
    setSurvolee(doublePageId);
  }

  // La miniature déposée prend le rang de celle qu'on vise ; les autres glissent d'un rang.
  function depot(evenement: DragEvent, cible: DoublePageDuLivre) {
    setSurvolee(null);
    const deplacee = evenement.dataTransfer.getData(TYPE_GLISSER_DOUBLE_PAGE);
    if (!deplacee || deplacee === cible.id || cible.position === null) return;
    evenement.preventDefault();
    surDeplacer(deplacee, cible.position);
  }

  return (
    <nav className={styles.bande} aria-label="Doubles pages intérieures">
      <ol className={styles.miniatures}>
        {interieures.map((doublePage) => {
          const estCourante = doublePage.id === courante?.id;
          return (
            <li
              key={doublePage.id}
              className={[
                styles.miniature,
                estCourante && styles.courante,
                survolee === doublePage.id && styles.visee,
              ]
                .filter(Boolean)
                .join(" ")}
              onDragOver={(evenement) => survol(evenement, doublePage.id)}
              onDragLeave={() => setSurvolee(null)}
              onDrop={(evenement) => depot(evenement, doublePage)}
            >
              <Glissable
                className={styles.choisirPage}
                // Changer de page n'écrit rien : toujours permis, même hors-ligne.
                actif
                glissable={actif}
                aria-current={estCourante ? "page" : undefined}
                aria-label={libelleDoublePage(
                  doublePage.role,
                  doublePage.position,
                )}
                surDebutGlisser={(evenement) => {
                  evenement.dataTransfer.setData(
                    TYPE_GLISSER_DOUBLE_PAGE,
                    doublePage.id,
                  );
                  evenement.dataTransfer.effectAllowed = "move";
                }}
                surActiver={() => surChoisir(doublePage.id)}
              >
                <DoublePage
                  doublePage={doublePage}
                  fond={fond}
                  photos={photos}
                />
              </Glissable>
            </li>
          );
        })}
        <li className={styles.ajouter}>
          <button
            type="button"
            className={styles.boutonAjouter}
            disabled={!actif || !peutAjouter}
            aria-label="Ajouter une double page après la page courante"
            onClick={surAjouter}
          >
            <span aria-hidden="true">+</span>
          </button>
        </li>
      </ol>
      {courante && (
        <div className={styles.actionsPage}>
          <Bouton
            variante="tertiaire"
            taille="petit"
            disabled={!actif || rang <= 1}
            onClick={() => surDeplacer(courante.id, rang - 1)}
          >
            ← Déplacer à gauche
          </Bouton>
          <Bouton
            variante="tertiaire"
            taille="petit"
            disabled={!actif || rang >= interieures.length}
            onClick={() => surDeplacer(courante.id, rang + 1)}
          >
            Déplacer à droite →
          </Bouton>
          <Bouton
            variante="tertiaire"
            taille="petit"
            disabled={!actif}
            onClick={() => surDupliquer(courante.id)}
          >
            Dupliquer
          </Bouton>
          <Bouton
            variante="tertiaire"
            taille="petit"
            disabled={!actif}
            onClick={() => surSupprimer(courante.id)}
          >
            Supprimer
          </Bouton>
        </div>
      )}
    </nav>
  );
}
