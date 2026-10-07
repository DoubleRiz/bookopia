import type { ReactNode } from "react";
import styles from "./Banniere.module.css";

// Concerne toute la page et reste jusqu'à résolution. Seule la tonalité erreur sert pour l'instant.
export function Banniere({
  titre,
  children,
  action,
}: {
  titre: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.banniere} role="alert">
      <span className={styles.pastille} aria-hidden="true" />
      <div className={styles.texte}>
        <span className={styles.titre}>{titre}</span>
        {children}
      </div>
      {action}
    </div>
  );
}
