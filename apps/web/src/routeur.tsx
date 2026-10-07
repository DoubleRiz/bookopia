import { createBrowserRouter, redirect } from "react-router";
import { AdresseInconnue } from "./ecrans/AdresseInconnue";
import { actionConnexion, Connexion } from "./ecrans/Connexion";
import {
  actionDeconnexion,
  chargerEcranCreateur,
  EcranCreateur,
  EcranCreateurProvisoire,
} from "./ecrans/EcranCreateur";
import { ErreurChargement } from "./ecrans/ErreurChargement";
import { chargerExport, Export } from "./ecrans/Export";
import { chargerImport, ImportPhotos } from "./ecrans/ImportPhotos";
import { actionInscription, Inscription } from "./ecrans/Inscription";
import {
  actionLivreEnCours,
  chargerLivreEnCours,
  LivreEnCours,
} from "./ecrans/LivreEnCours";
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

// Adresses des spécifications fonctionnelles (§1) : un écran a une adresse propre, rechargeable.
export const routeur = createBrowserRouter([
  {
    // Dernier filet : une erreur qu'aucun écran n'attrape (action de formulaire en 500, par exemple).
    ErrorBoundary: () => (
      <main style={{ padding: "var(--espace-12) var(--espace-4)" }}>
        <ErreurChargement />
      </main>
    ),
    children: [
      // E0 (vitrine) n'existe pas encore : la racine mène à l'espace du Créateur,
      // qui renvoie à la connexion s'il n'y a pas de session.
      { path: "/", loader: () => redirect("/livres") },
      { path: "/connexion", Component: Connexion, action: actionConnexion },
      {
        path: "/inscription",
        Component: Inscription,
        action: actionInscription,
      },
      { path: "/deconnexion", action: actionDeconnexion },
      {
        loader: chargerEcranCreateur,
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
                loader: chargerMesLivres,
                action: actionMesLivres,
                Component: MesLivres,
                children: [
                  // S1, surcouche sur E4 : la liste reste affichée dessous.
                  {
                    path: "nouveau",
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
                loader: chargerLivreEnCours,
                action: actionLivreEnCours,
                Component: LivreEnCours,
                children: [
                  // E5, surcouche sur E7 : la réserve reste affichée dessous.
                  {
                    path: "import",
                    loader: chargerImport,
                    Component: ImportPhotos,
                  },
                ],
              },
              // E9 : écran à part entière, pas une surcouche de l'éditeur.
              {
                path: "/livre/:id/export",
                loader: chargerExport,
                Component: Export,
              },
            ],
          },
        ],
      },
      { path: "*", Component: AdresseInconnue },
    ],
  },
]);
