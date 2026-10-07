import {
  type ActionFunctionArgs,
  Form,
  redirect,
  useActionData,
  useNavigation,
} from "react-router";
import { inscriptionSchema } from "@bookopia/shared";
import { inscrire } from "../api/authentification";
import { Bouton } from "../composants/Bouton";
import { Champ } from "../composants/Champ";
import {
  adresseDeRetour,
  erreurDeFormulaire,
  erreursDeValidation,
  type ResultatFormulaire,
  texteDuChamp,
} from "../session";
import { EcranVisiteur } from "./EcranVisiteur";
import styles from "./Formulaire.module.css";

// Mêmes bornes que inscriptionSchema et que minimum_password_length de supabase/config.toml.
const LONGUEUR_MIN_MOT_DE_PASSE = 8;
const LONGUEUR_MAX_MOT_DE_PASSE = 128;
const LONGUEUR_MAX_NOM = 80;

export async function actionInscription({
  request,
}: ActionFunctionArgs): Promise<ResultatFormulaire | Response> {
  const donnees = await request.formData();
  const entree = inscriptionSchema.safeParse({
    nomAffichage: texteDuChamp(donnees, "nomAffichage"),
    email: texteDuChamp(donnees, "email"),
    motDePasse: texteDuChamp(donnees, "motDePasse"),
  });
  if (!entree.success) {
    return erreursDeValidation(entree.error);
  }
  try {
    await inscrire(entree.data);
  } catch (erreur) {
    return erreurDeFormulaire(erreur);
  }
  return redirect(adresseDeRetour(request));
}

// E2.
export function Inscription() {
  const resultat = useActionData<typeof actionInscription>();
  const enCours = useNavigation().state === "submitting";

  return (
    <EcranVisiteur
      invite="Déjà un compte ?"
      libelleLien="Se connecter"
      vers="/connexion"
    >
      <div className={styles.titre}>
        <h1>Créer un compte</h1>
        <p className={styles.sousTitre}>
          Il suffit d'un e-mail pour composer votre premier livre.
        </p>
      </div>
      <Form method="post" className={styles.formulaire}>
        {resultat?.message && (
          <p className={styles.erreurGlobale} role="alert">
            {resultat.message}
          </p>
        )}
        <Champ
          libelle="Votre nom"
          name="nomAffichage"
          autoComplete="name"
          required
          maxLength={LONGUEUR_MAX_NOM}
          erreurs={resultat?.champs?.nomAffichage}
        />
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
          autoComplete="new-password"
          placeholder={`${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum`}
          required
          minLength={LONGUEUR_MIN_MOT_DE_PASSE}
          maxLength={LONGUEUR_MAX_MOT_DE_PASSE}
          erreurs={resultat?.champs?.motDePasse}
        />
        <Bouton type="submit" taille="grand" enCours={enCours}>
          Créer mon compte
        </Bouton>
      </Form>
    </EcranVisiteur>
  );
}
