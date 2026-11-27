import { Link } from "react-router";
import { Logo } from "../composants/Logo";
import { PiedDePage } from "../composants/PiedDePage";
import styles from "./MentionsLegales.module.css";

// Deuxième système de navigation, à côté du menu (RGAA 12.1). Il liste les pages qui s'ouvrent
// sans contexte : un livre, son import ou son export demandent d'abord de choisir le livre.
// Page publique : les pages du Créateur y figurent, et mènent à la connexion sans session.
export function PlanDuSite() {
  return (
    <div className={styles.ecran}>
      <header className={styles.entete}>
        <Logo vers="/" />
      </header>

      <main className={styles.corps}>
        <h1 className={styles.titre}>Plan du site</h1>

        <ul>
          <li>
            <Link to="/">Accueil</Link>
          </li>
          <li>
            <Link to="/connexion">Se connecter</Link>
          </li>
          <li>
            <Link to="/inscription">Créer un compte</Link>
          </li>
          <li>
            <Link to="/livres">Mes livres</Link>
            <ul>
              <li>
                <Link to="/livres/nouveau">Nouveau livre</Link>
              </li>
            </ul>
          </li>
          <li>
            <Link to="/mentions-legales">Mentions légales</Link>
          </li>
          <li>
            <Link to="/politique-de-confidentialite">
              Politique de confidentialité
            </Link>
          </li>
          <li>
            <Link to="/accessibilite">Déclaration d'accessibilité</Link>
          </li>
        </ul>
      </main>

      <PiedDePage />
    </div>
  );
}
