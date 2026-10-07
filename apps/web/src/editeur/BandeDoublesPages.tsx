import { type DragEvent, useState } from "react";
import type { DoublePageDuLivre } from "../api/doublesPages";
import { Bouton } from "../composants/Bouton";
import {
  DoublePage,
  type Habillage,
  libelleDoublePage,
  type PhotoAffichee,
} from "../composants/DoublePage";
import styles from "./Editeur.module.css";
import { Glissable } from "./Glissable";

// Type du glisser-déposer d'une miniature : la donnée transportée est l'identifiant de la double page.
const TYPE_GLISSER_DOUBLE_PAGE = "application/x-bookopia-double-page";

// Le livre en miniatures, dans son ordre : couverture, intérieures, 4e. On choisit la page
// courante ; on réordonne une intérieure en glissant sa miniature, ou par les boutons de la
// page courante (clavier). La couverture et la 4e ne se déplacent ni ne se suppriment.
export function BandeDoublesPages({
  couverture,
  quatrieme,
  interieures,
  courante,
  habillage,
  photos,
  actif,
  peutAjouter,
  peutChangerGabarit,
  surChoisir,
  surAjouter,
  surDeplacer,
  surChangerGabarit,
  surDupliquer,
  surSupprimer,
}: {
  couverture: DoublePageDuLivre | undefined;
  quatrieme: DoublePageDuLivre | undefined;
  interieures: DoublePageDuLivre[];
  courante: DoublePageDuLivre | null;
  habillage: Habillage;
  photos: Map<string, PhotoAffichee>;
  actif: boolean;
  peutAjouter: boolean;
  peutChangerGabarit: boolean;
  surChoisir: (doublePageId: string) => void;
  surAjouter: () => void;
  surDeplacer: (doublePageId: string, position: number) => void;
  surChangerGabarit: () => void;
  surDupliquer: (doublePageId: string) => void;
  surSupprimer: (doublePageId: string) => void;
}) {
  const [survolee, setSurvolee] = useState<string | null>(null);
  const rang = courante?.position ?? 0;
  const interieureCourante = courante?.role === "interieur";

  // Une miniature qui se choisit ; seules les intérieures se glissent et reçoivent un dépôt.
  function miniature(doublePage: DoublePageDuLivre) {
    const estCourante = doublePage.id === courante?.id;
    const deplacable = doublePage.role === "interieur";
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
        onDragOver={
          deplacable
            ? (evenement) => survol(evenement, doublePage.id)
            : undefined
        }
        onDragLeave={deplacable ? () => setSurvolee(null) : undefined}
        onDrop={
          deplacable ? (evenement) => depot(evenement, doublePage) : undefined
        }
      >
        <Glissable
          className={styles.choisirPage}
          // Changer de page n'écrit rien : toujours permis, même hors-ligne.
          actif
          glissable={actif && deplacable}
          aria-current={estCourante ? "page" : undefined}
          aria-label={libelleDoublePage(doublePage.role, doublePage.position)}
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
            habillage={habillage}
            photos={photos}
          />
        </Glissable>
      </li>
    );
  }

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
    <nav className={styles.bande} aria-label="Doubles pages du livre">
      <ol className={styles.miniatures}>
        {couverture && miniature(couverture)}
        {interieures.map(miniature)}
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
        {quatrieme && miniature(quatrieme)}
      </ol>
      {courante && interieureCourante && (
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
            disabled={!actif || !peutChangerGabarit}
            onClick={surChangerGabarit}
          >
            Changer le gabarit
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
