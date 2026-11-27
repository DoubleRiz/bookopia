import { Link } from "react-router";
import { Logo } from "./Logo";
import styles from "./PiedDePage.module.css";

// Pied des écrans publics et des écrans du Créateur hors plein cadre : le logo, les pages
// d'information que la loi demande d'atteindre depuis le site, et le plan du site (RGAA 12.1).
// Le lien d'accessibilité porte l'état de conformité, comme le demande le RGAA :
// il change avec la déclaration.
export function PiedDePage() {
  return (
    <footer className={styles.pied}>
      <Logo vers="/" />
      <nav aria-label="Informations sur le site">
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
          <li>
            <Link to="/plan-du-site" className={styles.lien}>
              Plan du site
            </Link>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
