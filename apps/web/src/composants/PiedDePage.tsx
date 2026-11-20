import { Link } from "react-router";
import { Logo } from "./Logo";
import styles from "./PiedDePage.module.css";

// Pied des écrans publics : le logo, et les pages d'information que la loi demande d'atteindre
// depuis le site. Chaque nouvelle page légale (confidentialité, accessibilité) s'ajoute ici.
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
        </ul>
      </nav>
    </footer>
  );
}
