import type { GabaritAComposer } from "@bookopia/shared";
import { useState } from "react";
import type { DoublePageDuLivre } from "../api/doublesPages";
import { Bouton } from "../composants/Bouton";
import { DoublePage, type Habillage } from "../composants/DoublePage";
import { Modale } from "../composants/Modale";
import { aDuContenu, apercuDuGabarit, resumeDuGabarit } from "./choixGabarit";
import styles from "./Editeur.module.css";
import { naviguerEntreCartes } from "./navigationCartes";

const AUCUNE_PHOTO = new Map();

// Surcouche non adressée : choisir un autre gabarit de la famille pour la double page courante.
// Les cadres sont recréés vides : si la page porte une photo ou un texte, on confirme d'abord.
export function SurcoucheGabarits({
  gabarits,
  courante,
  habillage,
  surChoisir,
  surFermer,
}: {
  gabarits: GabaritAComposer[];
  courante: DoublePageDuLivre;
  habillage: Habillage;
  surChoisir: (gabaritId: string) => void;
  surFermer: () => void;
}) {
  const [aConfirmer, setAConfirmer] = useState<GabaritAComposer | null>(null);

  function choisir(gabarit: GabaritAComposer) {
    if (aDuContenu(courante)) setAConfirmer(gabarit);
    else surChoisir(gabarit.id);
  }

  if (aConfirmer) {
    return (
      <Modale titre="Remplacer le gabarit ?" onFermer={surFermer}>
        <div className={styles.formulaire}>
          <p>
            Les photos et les textes de cette double page seront retirés. Les
            photos restent dans la réserve.
          </p>
          <div className={styles.boutonsModale}>
            {/* Le choix sans risque a le focus : Entrée par réflexe ne retire rien. */}
            <Bouton
              variante="secondaire"
              onClick={() => setAConfirmer(null)}
              autoFocus
            >
              Garder l'actuel
            </Bouton>
            <Bouton onClick={() => surChoisir(aConfirmer.id)}>Remplacer</Bouton>
          </div>
        </div>
      </Modale>
    );
  }

  return (
    <Modale titre="Changer le gabarit" onFermer={surFermer} large>
      <ul className={styles.gabarits} onKeyDown={naviguerEntreCartes}>
        {gabarits.map((gabarit) => {
          const actuel = gabarit.id === courante.gabarit_origine_id;
          const resume = resumeDuGabarit(gabarit);
          return (
            <li key={gabarit.id}>
              <button
                type="button"
                className={styles.carteGabarit}
                disabled={actuel}
                aria-label={`${gabarit.nom}, ${resume}${actuel ? ", gabarit actuel" : ""}`}
                onClick={() => choisir(gabarit)}
              >
                <span className={styles.apercuGabarit} aria-hidden="true">
                  <DoublePage
                    doublePage={apercuDuGabarit(gabarit, courante.position)}
                    habillage={habillage}
                    photos={AUCUNE_PHOTO}
                  />
                </span>
                <span className={styles.nomGabarit} aria-hidden="true">
                  {gabarit.nom}
                  {actuel && <span className={styles.badgeActuel}>Actuel</span>}
                </span>
                <span className={styles.resumeGabarit} aria-hidden="true">
                  {resume}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modale>
  );
}
