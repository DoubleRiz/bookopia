import type { ReactNode } from "react";
import {
  Form,
  type LoaderFunctionArgs,
  NavLink,
  Outlet,
  redirect,
  useLoaderData,
  useMatches,
} from "react-router";
import {
  deconnecter,
  lireUtilisateurConnecte,
  type Utilisateur,
} from "../api/authentification";
import { Bouton } from "../composants/Bouton";
import { Logo } from "../composants/Logo";
import { Squelette } from "../composants/Squelette";
import { sousSession } from "../session";
import styles from "./EcranCreateur.module.css";

export async function chargerEcranCreateur({ request }: LoaderFunctionArgs) {
  return sousSession(request, lireUtilisateurConnecte);
}

export async function actionDeconnexion() {
  await deconnecter();
  return redirect("/connexion");
}

// null : Créateur pas encore connu (squelette) ; undefined : inconnu après une erreur (rien).
function Entete({
  utilisateur,
}: {
  utilisateur: Utilisateur | null | undefined;
}) {
  return (
    <header className={styles.entete}>
      <Logo vers="/livres" />
      <div className={styles.espaceur} />
      <NavLink to="/livres" className={styles.lienNavigation}>
        Mes livres
      </NavLink>
      {utilisateur ? (
        <>
          <span
            className={styles.avatar}
            role="img"
            title={utilisateur.nom_affichage}
            aria-label={`Connecté en tant que ${utilisateur.nom_affichage}`}
          >
            {utilisateur.nom_affichage.charAt(0).toUpperCase()}
          </span>
          <Form method="post" action="/deconnexion">
            <Bouton type="submit" variante="tertiaire">
              Se déconnecter
            </Bouton>
          </Form>
        </>
      ) : (
        utilisateur === null && (
          <Squelette largeur="44px" hauteur="44px" rayon="50%" />
        )
      )}
    </header>
  );
}

// Enveloppe des écrans du Créateur : en-tête commun, contenu de l'écran dessous.
// Les écrans plein cadre (éditeur, export) portent leur propre barre : pas d'en-tête commun, pas de marges.
export function EcranCreateur() {
  const utilisateur = useLoaderData<typeof chargerEcranCreateur>();
  const pleinCadre = useMatches().some(
    (etape) =>
      (etape.handle as { pleinCadre?: boolean } | undefined)?.pleinCadre,
  );
  return (
    <div className={styles.ecran}>
      {!pleinCadre && <Entete utilisateur={utilisateur} />}
      <main className={pleinCadre ? styles.pleinCadre : styles.corps}>
        <Outlet />
      </main>
    </div>
  );
}

// La même enveloppe sans le Créateur : au premier affichage, pendant que les loaders tournent,
// ou quand la lecture du Créateur a échoué pour une autre raison que la session.
export function EcranCreateurProvisoire({
  enChargement = false,
  children,
}: {
  enChargement?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.ecran}>
      <Entete utilisateur={enChargement ? null : undefined} />
      <main className={styles.corps} aria-busy={enChargement || undefined}>
        {children}
      </main>
    </div>
  );
}
