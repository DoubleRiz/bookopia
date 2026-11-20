import { Link } from "react-router";
import { Logo } from "./Logo";
import styles from "./PiedDePage.module.css";

// Pied des écrans publics : le logo, et les pages d'information que la loi demande d'atteindre
// depuis le site. Le lien d'accessibilité porte l'état de conformité, comme le demande le RGAA :
// il change avec la déclaration.
export function PiedDePage() {
  return (
    <footer className={styles.pied}>
      <Logo vers="/" />
      <nav aria-label="Informations légales">
        <ul className={styles.liens}>
          <li>
            <Link to="/mentions-legales" className={styles.lien}>
              Mentions légales
            </Link>
          </li>
          <li>
            <Link to="/politique-de-confidentialite" className={styles.lien}>
              Politique de confidentialité
            </Link>
          </li>
          <li>
            <Link to="/accessibilite" className={styles.lien}>
              Accessibilité : partiellement conforme
            </Link>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
