import type { ButtonHTMLAttributes } from "react";
import styles from "./Bouton.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  // destructif : réservé à l'irréversible, dans une modale de confirmation.
  variante?: "principal" | "secondaire" | "tertiaire" | "destructif";
  taille?: "grand" | "moyen" | "petit";
  enCours?: boolean;
};

export function Bouton({
  variante = "principal",
  taille = "moyen",
  enCours = false,
  className,
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      className={[styles.bouton, styles[variante], styles[taille], className]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || enCours}
      aria-busy={enCours || undefined}
      {...props}
    >
      {enCours && <span className={styles.tour} aria-hidden="true" />}
      {children}
    </button>
  );
}
