import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";
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

// Une navigation qui a l'apparence d'un bouton : même style, mais c'est un lien.
// `externe` : une adresse hors du routeur (un fichier à télécharger), donc un lien ordinaire.
export function LienBouton({
  vers,
  externe = false,
  variante = "principal",
  taille = "moyen",
  children,
  ...props
}: {
  vers: string;
  externe?: boolean;
  variante?: "principal" | "secondaire" | "tertiaire";
  taille?: "grand" | "moyen" | "petit";
  children: ReactNode;
  "aria-label"?: string;
}) {
  const classe = [styles.bouton, styles[variante], styles[taille]].join(" ");
  return externe ? (
    <a href={vers} className={classe} {...props}>
      {children}
    </a>
  ) : (
    <Link to={vers} className={classe} {...props}>
      {children}
    </Link>
  );
}
