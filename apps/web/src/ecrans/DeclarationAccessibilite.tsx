import { Logo } from "../composants/Logo";
import { PiedDePage } from "../composants/PiedDePage";
import styles from "./MentionsLegales.module.css";

const CONTACT = "gautier.baleda@gmail.com";

// Déclaration d'accessibilité, sur le modèle du RGAA. Page publique et statique, hors enveloppe
// du Créateur. Elle ne déclare que ce que l'audit a établi : chaque chiffre et chaque défaut
// vient de docs/audit-rgaa.md, à mettre à jour avec lui (et le libellé du pied de page aussi).
export function DeclarationAccessibilite() {
  return (
    <div className={styles.ecran}>
      <header className={styles.entete}>
        <Logo vers="/" />
      </header>

      <main className={styles.corps}>
        <h1 className={styles.titre}>Déclaration d'accessibilité</h1>

        <p>
          Gautier Baleda s'engage à rendre Bookopia accessible, conformément à
          l'article 47 de la loi n° 2005-102 du 11 février 2005. Bookopia est
          édité à titre non professionnel et n'est pas soumis à cette obligation
          : il l'applique volontairement.
        </p>
        <p>
          Cette déclaration s'applique au site Bookopia et à l'espace de
          création des livres.
        </p>

        <section>
          <h2>État de conformité</h2>
          <p>
            Bookopia est <strong>partiellement conforme</strong> avec le
            référentiel général d'amélioration de l'accessibilité (RGAA, version
            4.1.2), en raison de la non-conformité listée plus bas.
          </p>
        </section>

        <section>
          <h2>Résultats des tests</h2>
          <p>
            L'audit du 20 novembre 2026, mis à jour le 27 novembre 2026 après
            deux séries de corrections, montre que 98,3 % des critères
            applicables du RGAA sont respectés : 57 critères conformes sur 58.
            Avant les corrections, le taux était de 83,1 %. Les deux critères
            qui portent sur le PDF exporté relèvent d'une dérogation et ne sont
            pas comptés : s'ils l'étaient, le taux serait de 95,0 %.
          </p>
          <p>
            Deux critères n'ont pas encore été vérifiés : la compatibilité des
            composants de l'import, de l'éditeur et de l'export avec un lecteur
            d'écran, et la validité du code source. Le taux sera mis à jour
            quand ils le seront.
          </p>
        </section>

        <section>
          <h2>Contenus non accessibles</h2>
          <h3>Non-conformités</h3>
          <ul>
            <li>
              Dans l'éditeur, les photos de la réserve sont décrites par leur
              nom de fichier, pas par leur contenu.
            </li>
          </ul>
          <h3>Dérogations pour charge disproportionnée</h3>
          <p>
            Le PDF exporté n'est pas accessible, et aucune version accessible
            n'est proposée. C'est un fichier d'impression, destiné à
            l'imprimeur, fait des photos personnelles du Créateur. Le rendre
            accessible demanderait de décrire chaque photo, ce que seul le
            Créateur peut faire : la charge serait disproportionnée pour un
            fichier qui n'est pas fait pour être lu à l'écran. Les textes du
            livre et l'ordre de ses doubles pages se consultent dans l'éditeur ;
            les photos y seront décrites quand la non-conformité ci-dessus sera
            corrigée.
          </p>
          <h3>Contenus non soumis à l'obligation d'accessibilité</h3>
          <p>Aucun.</p>
        </section>

        <section>
          <h2>Établissement de cette déclaration</h2>
          <p>
            Cette déclaration a été établie le 20 novembre 2026 et mise à jour
            le 27 novembre 2026, à partir d'un audit réalisé par l'éditeur
            lui-même.
          </p>
          <h3>Technologies utilisées</h3>
          <p>HTML, CSS, JavaScript, WAI-ARIA.</p>
          <h3>Environnement de test</h3>
          <p>
            Chromium sur macOS, au clavier, en 1280, 640 et 320 pixels de large.
            Aucun test n'a encore été fait avec un lecteur d'écran.
          </p>
          <h3>Outils</h3>
          <p>
            Relevé automatique de la structure, des noms accessibles et des
            contrastes avec Playwright, inspecteur du navigateur, captures
            d'écran.
          </p>
          <h3>Pages vérifiées</h3>
          <ul>
            <li>Accueil</li>
            <li>Connexion</li>
            <li>
              Mes livres, avec la création, le renommage et la suppression
            </li>
            <li>Import de photos</li>
            <li>Éditeur</li>
            <li>Export</li>
            <li>Mentions légales</li>
            <li>Déclaration d'accessibilité</li>
            <li>Plan du site</li>
          </ul>
        </section>

        <section>
          <h2>Retour d'information et contact</h2>
          <p>
            Si vous n'arrivez pas à accéder à un contenu ou à un service,
            écrivez à <a href={`mailto:${CONTACT}`}>{CONTACT}</a> : nous vous
            indiquerons une autre façon d'y accéder.
          </p>
        </section>

        <section>
          <h2>Voies de recours</h2>
          <p>
            Si vous nous avez signalé un défaut d'accessibilité sans obtenir de
            réponse satisfaisante, vous pouvez saisir le Défenseur des droits :
          </p>
          <ul>
            <li>
              par le formulaire en ligne :{" "}
              <a href="https://formulaire.defenseurdesdroits.fr/">
                formulaire.defenseurdesdroits.fr
              </a>{" "}
              ;
            </li>
            <li>
              auprès d'un délégué de votre région :{" "}
              <a href="https://www.defenseurdesdroits.fr/carte-des-delegues">
                carte des délégués
              </a>{" "}
              ;
            </li>
            <li>par téléphone : 09 69 39 00 00 ;</li>
            <li>
              par courrier, gratuit et sans timbre : Défenseur des droits, Libre
              réponse 71120, 75342 Paris CEDEX 07.
            </li>
          </ul>
        </section>
      </main>

      <PiedDePage />
    </div>
  );
}
