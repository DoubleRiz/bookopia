import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Logo } from "../composants/Logo";
import styles from "./EcranVisiteur.module.css";

// Enveloppe des écrans du Visiteur (E1, E2) : en-tête réduit, formulaire à gauche, décor à droite.
// Le lien d'en-tête conserve l'adresse de retour : passer de la connexion à l'inscription ne la perd pas.
export function EcranVisiteur({
  invite,
  libelleLien,
  vers,
  children,
}: {
  invite: string;
  libelleLien: string;
  vers: string;
  children: ReactNode;
}) {
  const { search } = useLocation();

  return (
    <div className={styles.ecran}>
      <header className={styles.entete}>
        <Logo vers="/" />
        <div className={styles.espaceur} />
        <span className={styles.invite}>{invite}</span>
        <Link to={vers + search} className={styles.lienEntete}>
          {libelleLien}
        </Link>
      </header>
      <main className={styles.corps}>
        <div className={styles.colonneFormulaire}>
          <div className={styles.contenu}>{children}</div>
        </div>
        <div className={styles.decor} aria-hidden="true">
          <div className={styles.forme} />
        </div>
      </main>
    </div>
  );
}
