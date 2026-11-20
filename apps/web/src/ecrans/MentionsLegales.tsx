import { Logo } from "../composants/Logo";
import { PiedDePage } from "../composants/PiedDePage";
import styles from "./MentionsLegales.module.css";

const CONTACT = "gautier.baleda@gmail.com";

// Mentions exigées par l'article 6 de la LCEN : éditeur, directeur de la publication, hébergeur.
// Page publique et statique, hors enveloppe du Créateur : elle s'ouvre sans compte.
export function MentionsLegales() {
  return (
    <div className={styles.ecran}>
      <header className={styles.entete}>
        <Logo vers="/" />
      </header>

      <main className={styles.corps}>
        <h1 className={styles.titre}>Mentions légales</h1>

        <section>
          <h2>Éditeur du site</h2>
          <p>
            Bookopia est édité à titre non professionnel par Gautier Baleda, qui
            en est aussi le directeur de la publication.
          </p>
          <p>
            Contact : <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
          </p>
        </section>

        <section>
          <h2>Hébergement</h2>
          <p>
            L'application (pages et scripts) est hébergée par Vercel Inc., 440 N
            Barranca Ave #4133, Covina, CA 91723, États-Unis.
          </p>
          <p>
            Les comptes, les livres et les photos sont hébergés par Supabase
            Pte. Ltd., 65 Chulia Street, OCBC Centre, Singapour 049513.
          </p>
        </section>
      </main>

      <PiedDePage />
    </div>
  );
}
