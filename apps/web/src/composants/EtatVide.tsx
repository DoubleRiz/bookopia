import type { ReactNode } from "react";
import styles from "./EtatVide.module.css";

// Aucune donnée, et c'est normal : un message, et l'action qui remplit l'écran quand elle existe.
export function EtatVide({
  titre,
  children,
  action,
}: {
  titre: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.etatVide}>
      <h2>{titre}</h2>
      <p className={styles.texte}>{children}</p>
      {action}
    </div>
  );
}
