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
            4.1.2), en raison des non-conformités listées plus bas.
          </p>
        </section>

        <section>
          <h2>Résultats des tests</h2>
          <p>
            L'audit du 20 novembre 2026 montre que 83,1 % des critères
            applicables du RGAA sont respectés : 49 critères conformes sur 59.
          </p>
          <p>
            Deux critères n'ont pas encore été vérifiés : la compatibilité des
            composants de l'éditeur avec un lecteur d'écran, et la validité du
            code source. Le taux sera mis à jour quand ils le seront.
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
            <li>
              La bordure des champs de saisie, et celle des cadres vides de
              l'éditeur, n'est pas assez contrastée.
            </li>
            <li>
              Sur l'accueil, le nom des liens « Essayer ce modèle » ne reprend
              pas leur texte visible. Sur l'écran d'export, le mot « Corriger »
              des liens de la liste n'est pas lu par les lecteurs d'écran.
            </li>
            <li>
              Dans l'éditeur, quitter l'écriture d'un texte avec Échap fait
              perdre la position du clavier dans la page.
            </li>
            <li>
              Sur la page de connexion, le lien « Créer un compte » ne se
              distingue du texte voisin que par sa couleur.
            </li>
            <li>
              Dans l'éditeur, la miniature de la double page affichée ne montre
              pas le focus du clavier.
            </li>
            <li>
              À 320 pixels de large, l'accueil défile à l'horizontale, et un
              bouton de l'éditeur recouvre une consigne.
            </li>
            <li>
              Les pages publiques et la liste des livres n'offrent qu'un seul
              moyen de navigation : ni plan du site ni recherche.
            </li>
            <li>
              Le PDF exporté est un fichier destiné à l'imprimeur : il n'est pas
              accessible, et aucune version accessible n'est proposée.
            </li>
          </ul>
          <h3>Dérogations pour charge disproportionnée</h3>
          <p>Aucune.</p>
          <h3>Contenus non soumis à l'obligation d'accessibilité</h3>
          <p>Aucun.</p>
        </section>

        <section>
          <h2>Établissement de cette déclaration</h2>
          <p>
            Cette déclaration a été établie le 20 novembre 2026, à partir d'un
            audit réalisé par l'éditeur lui-même.
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
