import { Logo } from "../composants/Logo";
import { PiedDePage } from "../composants/PiedDePage";
import styles from "./MentionsLegales.module.css";

const CONTACT = "gautier.baleda@gmail.com";

// Information RGPD (art. 13) : ce qui est collecté, pourquoi, combien de temps, et qui le reçoit.
// Page publique et statique, hors enveloppe du Créateur : elle s'ouvre sans compte. Chaque
// affirmation reflète le code et le schéma (supabase/migrations) : la corriger avec eux.
export function PolitiqueConfidentialite() {
  return (
    <div className={styles.ecran}>
      <header className={styles.entete}>
        <Logo vers="/" />
      </header>

      <main className={styles.corps}>
        <h1 className={styles.titre}>Politique de confidentialité</h1>

        <section>
          <h2>Responsable du traitement</h2>
          <p>
            Bookopia est édité à titre non professionnel par Gautier Baleda,
            responsable du traitement de vos données. Pour toute question :{" "}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </section>

        <section>
          <h2>Données collectées</h2>
          <ul>
            <li>
              Votre compte : adresse e-mail, mot de passe (conservé sous forme
              hachée par Supabase) et nom d'affichage.
            </li>
            <li>Vos livres : titres, textes, composition des pages.</li>
            <li>
              Vos photos : une version réduite à la taille utile pour
              l'impression et une vignette. Les métadonnées, dont le lieu de
              prise de vue, sont retirées dans votre navigateur avant l'envoi.
            </li>
            <li>
              Pour chaque photo : nom du fichier d'origine, empreinte du
              fichier, dimensions et date de prise de vue.
            </li>
            <li>Les PDF que vous exportez.</li>
            <li>
              À chaque connexion : votre adresse IP et votre navigateur,
              enregistrés par Supabase dans ses sessions et son journal de
              connexions.
            </li>
          </ul>
          <p>
            Bookopia n'utilise aucun traceur, aucun cookie publicitaire et
            aucune mesure d'audience. Le navigateur garde deux choses : votre
            session de connexion, nécessaire au service, et un réglage
            d'affichage (réserve de photos ouverte ou fermée).
          </p>
        </section>

        <section>
          <h2>Finalité et base légale</h2>
          <p>
            Finalité : vous permettre de créer vos livres photo et d'en exporter
            un PDF prêt pour l'impression. Base légale : l'exécution du service
            que vous avez demandé (RGPD, art. 6.1.b) pour votre compte et vos
            livres. Vos données ne servent à aucune autre fin et ne sont ni
            vendues ni cédées. Vos livres ne sont visibles que par vous.
          </p>
        </section>

        <section>
          <h2>Import depuis Google Photos</h2>
          <p>
            Cet import est facultatif et repose sur votre consentement : il ne
            démarre que si vous cliquez pour vous connecter à Google.
          </p>
          <ul>
            <li>
              Bookopia charge le script d'identification de Google
              (accounts.google.com) seulement à ce moment-là, et demande
              l'autorisation « photospicker.mediaitems.readonly » : lire les
              seules photos que vous choisissez dans le sélecteur de Google.
            </li>
            <li>
              Google reçoit votre adresse IP, des informations sur votre
              navigateur, et sait quelles photos vous sélectionnez. Il ne reçoit
              aucune donnée de votre compte Bookopia ni de vos livres.
            </li>
            <li>
              Les photos choisies sont téléchargées par votre navigateur, puis
              suivent le même chemin qu'un fichier de votre ordinateur. Le jeton
              d'accès reste en mémoire environ une heure et n'est jamais
              enregistré.
            </li>
          </ul>
          <p>
            Le traitement des données par Google relève de la politique de
            confidentialité de Google. Vous pouvez retirer l'autorisation à tout
            moment depuis votre compte Google.
          </p>
        </section>

        <section>
          <h2>Durée de conservation</h2>
          <p>
            Vos données sont conservées jusqu'à leur suppression par vous :
            aucune suppression automatique n'est programmée. La suppression de
            votre compte efface vos livres, vos photos et vos PDF.
          </p>
        </section>

        <section>
          <h2>Qui reçoit vos données</h2>
          <ul>
            <li>
              Supabase Pte. Ltd. (Singapour), sous-traitant : base de données,
              authentification et fichiers. Les données du projet sont hébergées
              à Paris, dans l'Union européenne.
            </li>
            <li>
              Vercel Inc. (États-Unis) : distribution des pages et des scripts
              de l'application. Vercel ne reçoit pas vos livres ni vos photos,
              mais, comme tout hébergeur web, voit l'adresse IP des visiteurs.
            </li>
            <li>
              Google, pour l'import depuis Google Photos, comme indiqué plus
              haut.
            </li>
          </ul>
          <p>
            Supabase, Vercel et Google sont établis hors de l'Union européenne :
            des données peuvent donc être traitées hors de l'Union, dans le
            cadre des garanties prévues par le RGPD (art. 44 et suivants).
          </p>
        </section>

        <section>
          <h2>Vos droits</h2>
          <p>
            Vous disposez des droits d'accès, de rectification, d'effacement et
            de portabilité de vos données.
          </p>
          <ul>
            <li>
              Vous supprimez vos livres, vos photos et votre compte depuis votre
              espace personnel.
            </li>
            <li>
              Pour l'accès, la rectification et la portabilité, écrivez à{" "}
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </li>
          </ul>
          <p>
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez
            saisir la <a href="https://www.cnil.fr/fr/plaintes">CNIL</a>.
          </p>
        </section>
      </main>

      <PiedDePage />
    </div>
  );
}
