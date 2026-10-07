import {
  type ActionFunctionArgs,
  Form,
  redirect,
  useActionData,
  useNavigation,
} from "react-router";
import { connecter } from "../api/authentification";
import { Bouton } from "../composants/Bouton";
import { Champ } from "../composants/Champ";
import {
  adresseDeRetour,
  erreurDeFormulaire,
  type ResultatFormulaire,
  texteDuChamp,
} from "../session";
import { EcranVisiteur } from "./EcranVisiteur";
import styles from "./Formulaire.module.css";

export async function actionConnexion({
  request,
}: ActionFunctionArgs): Promise<ResultatFormulaire | Response> {
  const donnees = await request.formData();
  try {
    await connecter({
      email: texteDuChamp(donnees, "email"),
      motDePasse: texteDuChamp(donnees, "motDePasse"),
    });
  } catch (erreur) {
    return erreurDeFormulaire(erreur);
  }
  return redirect(adresseDeRetour(request));
}

// E1. Pas de règle de longueur ici, comme dans l'API : la refuser trahirait la règle d'inscription.
export function Connexion() {
  const resultat = useActionData<typeof actionConnexion>();
  const enCours = useNavigation().state === "submitting";

  return (
    <EcranVisiteur
      invite="Pas encore de compte ?"
      libelleLien="Créer un compte"
      vers="/inscription"
    >
      <div className={styles.titre}>
        <h1>Se connecter</h1>
        <p className={styles.sousTitre}>Vos livres vous attendent.</p>
      </div>
      <Form method="post" className={styles.formulaire}>
        {resultat?.message && (
          <p className={styles.erreurGlobale} role="alert">
            {resultat.message}
          </p>
        )}
        <Champ
          libelle="Adresse e-mail"
          name="email"
          type="email"
          autoComplete="email"
          required
          erreurs={resultat?.champs?.email}
        />
        <Champ
          libelle="Mot de passe"
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          required
          erreurs={resultat?.champs?.motDePasse}
        />
        <Bouton type="submit" taille="grand" enCours={enCours}>
          Se connecter
        </Bouton>
      </Form>
    </EcranVisiteur>
  );
}
