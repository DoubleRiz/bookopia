import { useState } from "react";
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "react-router";
import { choisirGabaritsInterieurs, creerProjetSchema } from "@bookopia/shared";
import { listerGabaritsInterieurs, listerModeles } from "../api/catalogue";
import { ErreurBase } from "../api/client";
import { creerProjet } from "../api/projets";
import { Bouton } from "../composants/Bouton";
import { CatalogueModeles } from "../composants/CatalogueModeles";
import { Champ } from "../composants/Champ";
import { Modale } from "../composants/Modale";
import { Squelette } from "../composants/Squelette";
import {
  erreurDeFormulaire,
  type ResultatFormulaire,
  sousSession,
  texteDuChamp,
} from "../session";
import styles from "./NouveauLivre.module.css";

const TITRE_PAR_DEFAUT = "Livre sans titre";
const SOUS_TITRE = "Le modèle est copié dans le livre, pas lié à lui.";

export async function chargerNouveauLivre({ request }: LoaderFunctionArgs) {
  return sousSession(request, listerModeles);
}

// Le catalogue est relu ici plutôt que pris dans le formulaire : un modèle retiré entre-temps
// est refusé avec un message, et les gabarits choisis sont ceux du moment.
export async function actionNouveauLivre({
  request,
}: ActionFunctionArgs): Promise<ResultatFormulaire | Response> {
  return sousSession(request, async () => {
    const donnees = await request.formData();
    const modeleId = texteDuChamp(donnees, "modele");
    // Facultatif pour le Créateur, obligatoire pour la base : le titre par défaut est posé ici.
    const titre = texteDuChamp(donnees, "titre").trim() || TITRE_PAR_DEFAUT;

    let projetId: string;
    try {
      const [modeles, gabarits] = await Promise.all([
        listerModeles(),
        listerGabaritsInterieurs(),
      ]);
      const modele = modeles.find((candidat) => candidat.id === modeleId);
      if (!modele) {
        return {
          message: "Ce modèle n'est plus proposé. Choisissez-en un autre.",
        };
      }
      const entree = creerProjetSchema.safeParse({
        titre,
        modeleLivreId: modele.id,
        gabaritsInterieursIds: choisirGabaritsInterieurs(gabarits, modele),
      });
      if (!entree.success) {
        return {
          message: "Ce modèle ne peut pas être utilisé pour l'instant.",
        };
      }
      projetId = await creerProjet(entree.data);
    } catch (erreur) {
      // La base a refusé ce que le front croyait valide : catalogue incomplet, modèle retiré.
      if (
        erreur instanceof ErreurBase &&
        (erreur.code === "invalide" || erreur.code === "introuvable")
      ) {
        return {
          message: "Ce modèle ne peut pas être utilisé pour l'instant.",
        };
      }
      return erreurDeFormulaire(erreur);
    }
    // Un livre neuf est vide : on y entre, l'import est la suite naturelle.
    return redirect(`/livre/${projetId}`);
  });
}

// S1, surcouche adressée sur E4 : elle survit à un rechargement.
export function NouveauLivre() {
  const modeles = useLoaderData<typeof chargerNouveauLivre>();
  const resultat = useActionData<typeof actionNouveauLivre>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [selection, setSelection] = useState(modeles[0]?.id ?? "");

  const enCours =
    navigation.state !== "idle" && navigation.formAction === "/livres/nouveau";
  const modele = modeles.find((candidat) => candidat.id === selection);
  const fermer = () => void navigate("/livres");

  return (
    <Modale
      large
      titre="Nouveau livre"
      sousTitre={SOUS_TITRE}
      onFermer={fermer}
    >
      {modeles.length === 0 ? (
        <>
          <p>Aucun modèle n'est proposé pour l'instant.</p>
          <div className={styles.actions}>
            <Bouton variante="secondaire" onClick={fermer}>
              Fermer
            </Bouton>
          </div>
        </>
      ) : (
        <Form method="post" className={styles.formulaire}>
          {resultat?.message && (
            <p className={styles.erreurGlobale} role="alert">
              {resultat.message}
            </p>
          )}
          <CatalogueModeles
            modeles={modeles}
            name="modele"
            selection={selection}
            onChoisir={setSelection}
          />
          <Champ
            libelle="Titre du livre"
            name="titre"
            placeholder={TITRE_PAR_DEFAUT}
            aide="Facultatif · renommable partout"
            autoComplete="off"
          />
          {modele && (
            <div className={styles.copie}>
              <span className={styles.libelleCopie}>Ce qui sera copié</span>
              <p>
                {modele.theme ? `Thème ${modele.theme.nom} · ` : ""}
                {modele.nombre_doubles_pages_depart} doubles pages. Tout est
                modifiable dans le livre, sans effet sur le modèle.
              </p>
            </div>
          )}
          <div className={styles.actions}>
            <span className={styles.note}>Créé en brouillon</span>
            <Bouton type="button" variante="secondaire" onClick={fermer}>
              Annuler
            </Bouton>
            <Bouton type="submit" enCours={enCours}>
              Créer le livre
            </Bouton>
          </div>
        </Form>
      )}
    </Modale>
  );
}

// Le temps que le catalogue arrive : la surcouche s'ouvre déjà, avec la forme de la grille.
export function NouveauLivreEnChargement() {
  const navigate = useNavigate();
  return (
    <Modale
      large
      titre="Nouveau livre"
      sousTitre={SOUS_TITRE}
      onFermer={() => void navigate("/livres")}
    >
      <div className={styles.grilleChargement} aria-busy="true">
        {[0, 1, 2, 3].map((rang) => (
          <Squelette key={rang} largeur="100%" hauteur="140px" rayon="12px" />
        ))}
      </div>
    </Modale>
  );
}
