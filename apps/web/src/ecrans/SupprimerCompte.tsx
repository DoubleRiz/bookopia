import { useState } from "react";
import { useNavigate } from "react-router";
import { supprimerCompte } from "../api/compte";
import { confirmationValide, MOT_DE_CONFIRMATION } from "../api/dossiers";
import { Bouton } from "../composants/Bouton";
import { Champ } from "../composants/Champ";
import { Modale } from "../composants/Modale";
import { ErreurReseau } from "../api/client";
import styles from "./MesLivres.module.css";

// Suppression définitive du compte (BK-123). Le Créateur tape un mot : un clic par réflexe ne suffit pas.
export function ModaleSupprimerCompte({ onFermer }: { onFermer: () => void }) {
  const navigate = useNavigate();
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function supprimer() {
    setEnCours(true);
    setMessage(null);
    try {
      await supprimerCompte();
      await navigate("/", { replace: true });
    } catch (erreur) {
      setEnCours(false);
      // Le message reste dans la modale : la suppression se rejoue sans rien perdre.
      setMessage(
        erreur instanceof ErreurReseau
          ? "Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez."
          : "La suppression a échoué. Réessayez.",
      );
    }
  }

  return (
    <Modale titre="Supprimer mon compte ?" onFermer={onFermer}>
      <form
        className={styles.formulaire}
        onSubmit={(evenement) => {
          evenement.preventDefault();
          if (confirmationValide(saisie)) void supprimer();
        }}
      >
        {message && (
          <p className={styles.erreurGlobale} role="alert">
            {message}
          </p>
        )}
        <p>
          Votre compte, tous vos livres, leurs photos et leurs exports sont
          supprimés. Cette action est définitive.
        </p>
        <Champ
          libelle={`Pour confirmer, tapez « ${MOT_DE_CONFIRMATION} »`}
          name="confirmation"
          value={saisie}
          onChange={(evenement) => setSaisie(evenement.target.value)}
          autoComplete="off"
          autoFocus
        />
        <div className={styles.boutonsModale}>
          <Bouton type="button" variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton
            type="submit"
            variante="destructif"
            disabled={!confirmationValide(saisie)}
            enCours={enCours}
          >
            Supprimer mon compte
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
