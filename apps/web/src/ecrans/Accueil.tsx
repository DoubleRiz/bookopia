import { Link, useLoaderData } from "react-router";
import { lireUtilisateurConnecte } from "../api/authentification";
import { listerModelesPublics } from "../api/catalogue";
import { ErreurNonAuthentifie } from "../api/client";
import { LienBouton } from "../composants/Bouton";
import { Logo } from "../composants/Logo";
import livreExemple1x from "../assets/accueil/livre-exemple-250.webp";
import livreExemple2x from "../assets/accueil/livre-exemple-500.webp";
import ouvertGenereux1x from "../assets/accueil/ouvert-genereux-220.webp";
import ouvertGenereux2x from "../assets/accueil/ouvert-genereux-440.webp";
import ouvertRaconte1x from "../assets/accueil/ouvert-raconte-220.webp";
import ouvertRaconte2x from "../assets/accueil/ouvert-raconte-440.webp";
import ouvertRythme1x from "../assets/accueil/ouvert-rythme-220.webp";
import ouvertRythme2x from "../assets/accueil/ouvert-rythme-440.webp";
import vrac1x from "../assets/accueil/vrac-272.webp";
import vrac2x from "../assets/accueil/vrac-544.webp";
import styles from "./Accueil.module.css";

// Images de la vitrine en WebP, à la taille affichée par Accueil.module.css (1x) et au double pour
// les écrans haute densité (2x) : le navigateur ne télécharge que celle qu'il affiche (éco-conception).
function image(une: string, deux: string) {
  return { src: une, srcSet: `${une} 1x, ${deux} 2x` };
}

const LIVRE_EXEMPLE = image(livreExemple1x, livreExemple2x);
const VRAC = image(vrac1x, vrac2x);

// La vitrine est publique : l'absence de session n'est pas une erreur, elle change seulement l'en-tête
// et la destination de « Essayer ce modèle ». Le catalogue est lisible sans compte (RLS du modèle de livre).
export async function chargerAccueil() {
  const [connecte, modeles] = await Promise.all([
    lireUtilisateurConnecte().then(
      () => true,
      (erreur: unknown) => {
        if (erreur instanceof ErreurNonAuthentifie) return false;
        throw erreur;
      },
    ),
    listerModelesPublics(),
  ]);
  return { connecte, modeles };
}

// Même ordre de teintes que le catalogue de S1 : le fond de chaque carte de modèle.
const TEINTES = [
  "var(--couleur-ciel)",
  "var(--couleur-rose)",
  "var(--couleur-menthe)",
  "var(--couleur-beurre)",
];

// Chaque modèle se montre ouvert sur une double page de sa famille de gabarits.
// Compositions faites hors de l'application (photos libres, voir CREDITS.md).
const DOUBLES_PAGES_EXEMPLE: Record<string, ReturnType<typeof image>> = {
  genereux: image(ouvertGenereux1x, ouvertGenereux2x),
  rythme: image(ouvertRythme1x, ouvertRythme2x),
  raconte: image(ouvertRaconte1x, ouvertRaconte2x),
};

const ETAPES = [
  {
    titre: "Vous déversez tout",
    texte:
      "Le dossier entier, sans le trier avant. Les doublons, les ratés, les quatorze versions du même coucher de soleil : envoyez-les.",
    teinte: styles.ciel,
  },
  {
    titre: "Le livre se compose",
    texte:
      "Le modèle a déjà décidé du thème et des gabarits. Il reste à placer et à légender.",
    teinte: styles.rose,
  },
  {
    titre: "Vous imprimez",
    texte:
      "Export prêt pour l'imprimeur, format et fonds perdus compris. Le livre reste modifiable et réexportable.",
    teinte: styles.menthe,
  },
];

// Chaque phrase décrit ce que fait réellement l'application : une cible, jamais une conformité non auditée.
const ENGAGEMENTS = [
  {
    reference: "RGAA · WCAG 2.2 AA",
    titre: "Accessible",
    points: [
      "Contrastes vérifiés pour tous les textes.",
      "Tout ce qui se fait à la souris se fait aussi au clavier.",
      "Les animations s'arrêtent si votre système le demande.",
    ],
    teinte: styles.ciel,
  },
  {
    reference: "RGPD",
    titre: "Vos photos restent les vôtres",
    points: [
      "Aucun traceur publicitaire, aucune mesure d'audience.",
      "Vos photos sont réencodées dans votre navigateur : le lieu de prise de vue et les autres métadonnées ne sont jamais envoyés.",
      "Vos livres ne sont visibles que par vous.",
    ],
    teinte: styles.beurre,
  },
  {
    reference: "Éco-conception",
    titre: "Juste ce qu'il faut",
    points: [
      "Chaque photo est réduite à la taille utile pour l'impression avant l'envoi.",
      "Le PDF se fabrique sur votre machine, sans serveur de rendu.",
      "L'éditeur de texte ne se charge que quand vous écrivez.",
    ],
    teinte: styles.menthe,
  },
];

// Le modèle choisi survit à l'inscription : S1 s'ouvre ensuite avec lui déjà sélectionné.
function adresseEssai(modeleId: string, connecte: boolean) {
  const creation = `/livres/nouveau?modele=${modeleId}`;
  return connecte
    ? creation
    : `/inscription?retour=${encodeURIComponent(creation)}`;
}

// E0 : la porte d'entrée. L'espace « Mes livres » n'est accessible qu'une fois connecté.
export function Accueil() {
  const { connecte, modeles } = useLoaderData<typeof chargerAccueil>();

  return (
    <div className={styles.ecran}>
      <header className={styles.entete}>
        <Logo vers="/" />
        <div className={styles.espaceur} />
        <Link to="/" className={styles.lienNavigation} aria-current="page">
          Accueil
        </Link>
        {connecte ? (
          <LienBouton vers="/livres">Mes livres</LienBouton>
        ) : (
          <LienBouton vers="/connexion">Connexion</LienBouton>
        )}
      </header>

      <main>
        <section className={styles.accroche}>
          <div className={styles.texteAccroche}>
            <span className={styles.surtitre}>Livres photo imprimables</span>
            <h1 className={styles.titre}>
              Vos photos méritent mieux qu'un écran.{" "}
              <span className={styles.titreTouche}>Faites-en un livre.</span>
            </h1>
            <p className={styles.chapo}>
              Choisissez un modèle, glissez vos photos, ajustez la mise en page.
              Vous obtenez un fichier prêt à imprimer, pour un livre à
              feuilleter et à garder.
            </p>
            <div className={styles.actions}>
              <LienBouton vers="#catalogue" externe taille="grand">
                Choisir un modèle
              </LienBouton>
            </div>
            <span className={styles.reassurance}>
              <span className={styles.pastille} />
              Compte requis pour composer un livre · aucune carte bancaire avant
              l'impression
            </span>
          </div>

          <div className={styles.illustration} aria-hidden="true">
            <div className={styles.forme} />
            <div className={styles.vrac}>
              <div className={styles.enteteVrac}>
                <b>Été 2026</b>
                <span>80 photos éparpillées</span>
              </div>
              <img
                className={styles.grilleVrac}
                src={VRAC.src}
                srcSet={VRAC.srcSet}
                alt=""
              />
            </div>
            <div className={styles.fleche}>→</div>
            <img
              className={styles.livreExemple}
              src={LIVRE_EXEMPLE.src}
              srcSet={LIVRE_EXEMPLE.srcSet}
              alt=""
            />
            <span className={styles.etiquette}>Prêt à imprimer</span>
          </div>
        </section>

        <section className={styles.etapes} aria-label="Comment ça marche">
          <ol className={styles.listeEtapes}>
            {ETAPES.map((etape, rang) => (
              <li
                key={etape.titre}
                className={[styles.etape, etape.teinte].join(" ")}
              >
                <span className={styles.numero}>{rang + 1}</span>
                <h2 className={styles.titreEtape}>{etape.titre}</h2>
                <p className={styles.texteEtape}>{etape.texte}</p>
              </li>
            ))}
          </ol>
          <p className={styles.promesse}>
            <span className={styles.pastilleCta} />
            Rien n'est supprimé sans un geste explicite de votre part.
          </p>
        </section>

        <section id="catalogue" className={styles.catalogue}>
          <div className={styles.enteteCatalogue}>
            <h2 className={styles.titreCatalogue}>Commencez par un modèle</h2>
            <span className={styles.sousTitre}>
              Thème et gabarits se changent encore après.
            </span>
          </div>
          {modeles.length === 0 ? (
            <p className={styles.sousTitre}>
              Aucun modèle n'est proposé pour l'instant.
            </p>
          ) : (
            <ul className={styles.grilleModeles}>
              {modeles.map((modele, rang) => {
                const exemple = DOUBLES_PAGES_EXEMPLE[modele.famille];
                return (
                  <li key={modele.id} className={styles.carteModele}>
                    <div
                      className={styles.apercu}
                      style={{ background: TEINTES[rang % TEINTES.length] }}
                      aria-hidden="true"
                    >
                      {exemple ? (
                        <img
                          className={styles.livreOuvert}
                          src={exemple.src}
                          srcSet={exemple.srcSet}
                          // Sous la ligne de flottaison : chargée à l'approche du catalogue.
                          loading="lazy"
                          alt=""
                        />
                      ) : (
                        <div className={styles.livreApercu} />
                      )}
                    </div>
                    <div className={styles.corpsCarte}>
                      <h3 className={styles.nomModele}>{modele.nom}</h3>
                      <span className={styles.pages}>
                        {modele.nombre_doubles_pages_depart} doubles pages
                      </span>
                      <LienBouton
                        vers={adresseEssai(modele.id, connecte)}
                        taille="petit"
                        aria-label={`Essayer le modèle ${modele.nom}`}
                      >
                        Essayer ce modèle
                      </LienBouton>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          className={styles.engagements}
          aria-labelledby="titre-engagements"
        >
          <h2 id="titre-engagements" className={styles.titreCatalogue}>
            Nos engagements
          </h2>
          <ul className={styles.grilleEngagements}>
            {ENGAGEMENTS.map((engagement) => (
              <li
                key={engagement.reference}
                className={[styles.engagement, engagement.teinte].join(" ")}
              >
                <span className={styles.reference}>{engagement.reference}</span>
                <h3 className={styles.titreEtape}>{engagement.titre}</h3>
                <ul className={styles.points}>
                  {engagement.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className={styles.pied}>
        <Logo vers="/" />
      </footer>
    </div>
  );
}
