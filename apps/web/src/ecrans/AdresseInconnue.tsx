import { Link } from "react-router";
import { EtatVide } from "../composants/EtatVide";

// Adresse qui ne correspond à aucun écran. Hors enveloppe : on ne sait pas si le Visiteur est connecté.
export function AdresseInconnue() {
  return (
    <main style={{ padding: "var(--espace-12) var(--espace-4)" }}>
      <EtatVide
        titre="Cette adresse ne mène nulle part"
        action={<Link to="/livres">Retrouver mes livres</Link>}
      >
        Le lien est peut-être incomplet, ou l'écran a changé d'adresse.
      </EtatVide>
    </main>
  );
}
