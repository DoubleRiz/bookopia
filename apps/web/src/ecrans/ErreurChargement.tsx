import { useRevalidator, useRouteError } from "react-router";
import { ErreurReseau } from "../api/client";
import { Banniere } from "../composants/Banniere";
import { Bouton } from "../composants/Bouton";

// État « erreur de chargement » : bannière + Réessayer, dans l'enveloppe de l'écran qui a échoué.
// La session expirée n'arrive jamais ici : sousSession l'a déjà changée en redirection.
export function ErreurChargement() {
  const erreur = useRouteError();
  const { revalidate, state } = useRevalidator();

  const titre =
    erreur instanceof ErreurReseau
      ? "Le serveur ne répond pas"
      : "Le chargement a échoué";
  const detail =
    erreur instanceof ErreurReseau
      ? "Vérifiez votre connexion, puis réessayez."
      : "Ce n'est pas de votre fait. Réessayez dans un instant.";

  return (
    <Banniere
      titre={titre}
      action={
        <Bouton
          variante="secondaire"
          enCours={state === "loading"}
          onClick={() => void revalidate()}
        >
          Réessayer
        </Bouton>
      }
    >
      {detail}
    </Banniere>
  );
}
