import { createBrowserRouter, Outlet } from "react-router";
import { LienEvitement } from "./composants/LienEvitement";
import { Accueil, chargerAccueil } from "./ecrans/Accueil";
import { AdresseInconnue } from "./ecrans/AdresseInconnue";
import { actionConnexion, Connexion } from "./ecrans/Connexion";
import {
  actionDeconnexion,
  chargerEcranCreateur,
  EcranCreateur,
  EcranCreateurProvisoire,
} from "./ecrans/EcranCreateur";
import { DeclarationAccessibilite } from "./ecrans/DeclarationAccessibilite";
import { ErreurChargement } from "./ecrans/ErreurChargement";
import { actionInscription, Inscription } from "./ecrans/Inscription";
import {
  actionMesLivres,
  chargerMesLivres,
  MesLivres,
  MesLivresEnChargement,
} from "./ecrans/MesLivres";
import {
  actionNouveauLivre,
  chargerNouveauLivre,
  NouveauLivre,
} from "./ecrans/NouveauLivre";
import { MentionsLegales } from "./ecrans/MentionsLegales";
import { PolitiqueConfidentialite } from "./ecrans/PolitiqueConfidentialite";
import { PlanDuSite } from "./ecrans/PlanDuSite";
import { type AvecSurcouche, useFocusDePage } from "./ecrans/focusDePage";
import { revaliderSaufPageCourante } from "./ecrans/revalidation";
import { type AvecTitre, useTitreDePage } from "./ecrans/titreDePage";

type DonneesLivre = Awaited<
  ReturnType<typeof import("./ecrans/LivreEnCours").chargerLivreEnCours>
>;
type DonneesExport = Awaited<
  ReturnType<typeof import("./ecrans/Export").chargerExport>
>;
// Lu par EcranCreateur : l'écran occupe toute la fenêtre, sans l'en-tête.
type PleinCadre = { pleinCadre: boolean };

// Racine sans enveloppe : elle tient le titre de l'onglet à jour (handle.titre de chaque route)
// et rend le focus au titre de l'écran à chaque navigation. Elle porte aussi le lien d'évitement.
function Racine() {
  useTitreDePage();
  useFocusDePage();
  return (
    <>
      <LienEvitement />
      <Outlet />
    </>
  );
}

function ErreurRacine() {
  useTitreDePage();
  return (
    <>
      <LienEvitement />
      <main style={{ padding: "var(--espace-12) var(--espace-4)" }}>
        <ErreurChargement />
      </main>
    </>
  );
}

// Adresses des spécifications fonctionnelles (§1) : un écran a une adresse propre, rechargeable.
export const routeur = createBrowserRouter([
  {
    // Dernier filet : une erreur qu'aucun écran n'attrape (action de formulaire en 500, par exemple).
    Component: Racine,
    ErrorBoundary: ErreurRacine,
    children: [
      // E0, publique. L'espace du Créateur (/livres…) renvoie à la connexion sans session.
      {
        path: "/",
        handle: { titre: "Livres photo prêts à imprimer" } satisfies AvecTitre,
        loader: chargerAccueil,
        Component: Accueil,
      },
      {
        path: "/connexion",
        handle: { titre: "Se connecter" } satisfies AvecTitre,
        Component: Connexion,
        action: actionConnexion,
      },
      {
        path: "/inscription",
        handle: { titre: "Créer un compte" } satisfies AvecTitre,
        Component: Inscription,
        action: actionInscription,
      },
      { path: "/deconnexion", action: actionDeconnexion },
      {
        loader: chargerEcranCreateur,
        shouldRevalidate: revaliderSaufPageCourante,
        Component: EcranCreateur,
        HydrateFallback: () => (
          <EcranCreateurProvisoire enChargement>
            <MesLivresEnChargement />
          </EcranCreateurProvisoire>
        ),
        ErrorBoundary: () => (
          <EcranCreateurProvisoire>
            <ErreurChargement />
          </EcranCreateurProvisoire>
        ),
        children: [
          {
            // Route sans chemin : une erreur d'écran s'affiche sous l'en-tête, qui reste utilisable.
            ErrorBoundary: ErreurChargement,
            children: [
              {
                path: "/livres",
                handle: { titre: "Mes livres" } satisfies AvecTitre,
                loader: chargerMesLivres,
                action: actionMesLivres,
                Component: MesLivres,
                children: [
                  // S1, surcouche sur E4 : la liste reste affichée dessous.
                  {
                    path: "nouveau",
                    handle: {
                      titre: "Nouveau livre",
                      surcouche: true,
                    } satisfies AvecTitre & AvecSurcouche,
                    loader: chargerNouveauLivre,
                    action: actionNouveauLivre,
                    Component: NouveauLivre,
                  },
                ],
              },
              {
                // E7, réduit à la réserve. Son id sert à E5, qui lit le livre sans le recharger.
                id: "livre",
                path: "/livre/:id",
                handle: {
                  pleinCadre: true,
                  titre: (d?: DonneesLivre) => d?.projet.titre ?? "Livre",
                } satisfies AvecTitre & PleinCadre,
                shouldRevalidate: revaliderSaufPageCourante,
                // L'éditeur, l'import et l'export ne sont téléchargés qu'à leur ouverture (BK-133).
                lazy: async () => {
                  const m = await import("./ecrans/LivreEnCours");
                  return {
                    loader: m.chargerLivreEnCours,
                    action: m.actionLivreEnCours,
                    Component: m.LivreEnCours,
                  };
                },
                children: [
                  // E5, surcouche sur E7 : la réserve reste affichée dessous.
                  {
                    path: "import",
                    handle: {
                      titre: "Importer des photos",
                      surcouche: true,
                    } satisfies AvecTitre & AvecSurcouche,
                    lazy: async () => {
                      const m = await import("./ecrans/ImportPhotos");
                      return {
                        loader: m.chargerImport,
                        Component: m.ImportPhotos,
                      };
                    },
                  },
                ],
              },
              // E9 : écran à part entière, pas une surcouche de l'éditeur.
              {
                path: "/livre/:id/export",
                handle: {
                  pleinCadre: true,
                  titre: (d?: DonneesExport) =>
                    d ? `Exporter · ${d.projet.titre}` : "Exporter",
                } satisfies AvecTitre & PleinCadre,
                lazy: async () => {
                  const m = await import("./ecrans/Export");
                  return { loader: m.chargerExport, Component: m.Export };
                },
              },
            ],
          },
        ],
      },
      {
        path: "/mentions-legales",
        handle: { titre: "Mentions légales" } satisfies AvecTitre,
        Component: MentionsLegales,
      },
      {
        path: "/politique-de-confidentialite",
        handle: {
          titre: "Politique de confidentialité",
        } satisfies AvecTitre,
        Component: PolitiqueConfidentialite,
      },
      {
        path: "/accessibilite",
        handle: { titre: "Déclaration d'accessibilité" } satisfies AvecTitre,
        Component: DeclarationAccessibilite,
      },
      {
        path: "/plan-du-site",
        handle: { titre: "Plan du site" } satisfies AvecTitre,
        Component: PlanDuSite,
      },
      {
        path: "*",
        handle: { titre: "Adresse inconnue" } satisfies AvecTitre,
        Component: AdresseInconnue,
      },
    ],
  },
]);
