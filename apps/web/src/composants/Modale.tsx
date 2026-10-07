import { type ReactNode, useEffect, useId, useRef } from "react";
import styles from "./Modale.module.css";

// Sur <dialog> natif : showModal() piège le focus, rend le reste de la page inerte et gère Échap.
export function Modale({
  titre,
  sousTitre,
  children,
  onFermer,
  large = false,
}: {
  titre: string;
  sousTitre?: string;
  children: ReactNode;
  onFermer: () => void;
  large?: boolean;
}) {
  const reference = useRef<HTMLDialogElement>(null);
  const idTitre = useId();

  useEffect(() => {
    const dialogue = reference.current;
    const declencheur = document.activeElement;
    dialogue?.showModal();
    // React retire le dialogue du DOM avant ce nettoyage : le navigateur ne rend plus le focus
    // de lui-même, on le rend au bouton qui a ouvert la modale.
    return () => {
      dialogue?.close();
      if (declencheur instanceof HTMLElement && declencheur.isConnected) {
        declencheur.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={reference}
      className={[styles.modale, large && styles.large]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={idTitre}
      // Échap : c'est l'écran qui ferme, pour que l'adresse et l'état suivent.
      onCancel={(evenement) => {
        evenement.preventDefault();
        onFermer();
      }}
      // Le contenu remplit le dialogue : un clic qui l'atteint directement vient du voile.
      onClick={(evenement) => {
        if (evenement.target === evenement.currentTarget) {
          onFermer();
        }
      }}
    >
      <div className={styles.contenu}>
        <div className={styles.entete}>
          <h2 id={idTitre} className={styles.titre}>
            {titre}
          </h2>
          {sousTitre && <p className={styles.sousTitre}>{sousTitre}</p>}
        </div>
        {children}
      </div>
    </dialog>
  );
}
