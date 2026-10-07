import { composerLivre, type GabaritAComposer } from "@bookopia/shared";
import { useCallback, useEffect, useState } from "react";
import {
  type ActionFunctionArgs,
  data,
  Link,
  type LoaderFunctionArgs,
  Outlet,
  type FetcherWithComponents,
  useFetcher,
  useLoaderData,
  useNavigate,
} from "react-router";
import { z } from "zod";
import { ErreurBase } from "../api/client";
import {
  type DoublePageDuLivre,
  enregistrerComposition,
  listerDoublesPages,
  listerGabaritsDuLivre,
} from "../api/doublesPages";
import { cheminPdf, fondDuTheme, lireExport, urlDuPdf } from "../api/exports";
import {
  listerPhotos,
  lireProjet,
  supprimerPhoto,
  urlsDesVignettes,
} from "../api/photos";
import { Banniere } from "../composants/Banniere";
import { Bouton } from "../composants/Bouton";
import { Modale } from "../composants/Modale";
import { Editeur } from "../editeur/Editeur";
import {
  erreurDeFormulaire,
  type ResultatFormulaire,
  sousSession,
  texteDuChamp,
} from "../session";
import { ExportDuLivre } from "./ExportDuLivre";
import styles from "./LivreEnCours.module.css";

const identifiantSchema = z.uuid();

// Les gabarits de l'éditeur : ajout d'une double page, changement de gabarit. Un catalogue
// illisible ne bloque pas l'écran : ces gestes sont désactivés, et « Composer le livre » dira l'erreur.
async function lireGabarits(projetId: string): Promise<GabaritAComposer[]> {
  try {
    return await listerGabaritsDuLivre(projetId);
  } catch (erreur) {
    if (erreur instanceof z.ZodError) return [];
    throw erreur;
  }
}

// Un identifiant mal formé, un livre supprimé ou celui d'un autre : la même réponse, introuvable.
export async function chargerLivreEnCours({
  request,
  params,
}: LoaderFunctionArgs) {
  return sousSession(request, async () => {
    const identifiant = identifiantSchema.safeParse(params.id);
    const projet = identifiant.success
      ? await lireProjet(identifiant.data)
      : null;
    if (!projet) {
      throw data("Livre introuvable", { status: 404 });
    }
    const photos = await listerPhotos(projet.id);
    const urls = await urlsDesVignettes(
      projet.utilisateur_id,
      projet.id,
      photos,
    );
    const doublesPages = await listerDoublesPages(projet.id);
    const pdf = await lireExport(projet.id);
    return {
      projet,
      fond: fondDuTheme(projet.theme.palette),
      doublesPages,
      gabarits: await lireGabarits(projet.id),
      photos: photos.map((photo) => ({ ...photo, url: urls.get(photo.id) })),
      urlDuPdf: pdf
        ? await urlDuPdf(
            cheminPdf(projet.utilisateur_id, projet.id, pdf.cle_stockage),
            projet.titre,
          )
        : null,
    };
  });
}

type ResultatAction = ResultatFormulaire & { reussi?: true };

async function supprimer(donnees: FormData): Promise<ResultatAction> {
  try {
    await supprimerPhoto(texteDuChamp(donnees, "photoId"));
  } catch (erreur) {
    if (erreur instanceof ErreurBase && erreur.code === "introuvable") {
      return { message: "Cette photo n'existe plus. Rechargez la page." };
    }
    return erreurDeFormulaire(erreur);
  }
  return { reussi: true };
}

// Le moteur choisit les gabarits dans le navigateur ; composer_livre vérifie et écrit d'un coup.
async function composer(projetId: string): Promise<ResultatAction> {
  try {
    const [photos, gabarits] = await Promise.all([
      listerPhotos(projetId),
      listerGabaritsDuLivre(projetId),
    ]);
    await enregistrerComposition(projetId, composerLivre(photos, gabarits));
  } catch (erreur) {
    if (erreur instanceof ErreurBase && erreur.code === "introuvable") {
      return { message: "Ce livre n'existe plus." };
    }
    // Gabarit retiré ou photo supprimée entre la lecture et l'écriture.
    if (erreur instanceof ErreurBase && erreur.code === "invalide") {
      return { message: "Le catalogue a changé, recomposez le livre." };
    }
    if (erreur instanceof z.ZodError) {
      return {
        message:
          "Le catalogue de gabarits est illisible. Réessayez dans un instant.",
      };
    }
    return erreurDeFormulaire(erreur);
  }
  return { reussi: true };
}

// Deux écritures : supprimer une photo de la réserve, composer le livre.
// Le loader repasse ensuite, l'écran se met à jour de lui-même.
export async function actionLivreEnCours({
  request,
  params,
}: ActionFunctionArgs): Promise<ResultatAction> {
  return sousSession(request, async () => {
    const donnees = await request.formData();
    if (texteDuChamp(donnees, "intention") === "composer") {
      const identifiant = identifiantSchema.safeParse(params.id);
      return identifiant.success
        ? composer(identifiant.data)
        : { message: "Ce livre n'existe plus." };
    }
    return supprimer(donnees);
  });
}

type Photo = Awaited<ReturnType<typeof chargerLivreEnCours>>["photos"][number];

// Surcouche non adressée : la confirmation ne survit pas à un rechargement, c'est voulu.
function ModaleSupprimerPhoto({
  photo,
  onFermer,
}: {
  photo: Photo;
  onFermer: () => void;
}) {
  const fetcher = useFetcher<typeof actionLivreEnCours>();
  const reussi = fetcher.state === "idle" && fetcher.data?.reussi;
  useEffect(() => {
    if (reussi) onFermer();
  }, [reussi, onFermer]);

  return (
    <Modale
      titre={`Supprimer « ${photo.nom_fichier_origine} » ?`}
      onFermer={onFermer}
    >
      <fetcher.Form method="post" className={styles.formulaire}>
        <input type="hidden" name="intention" value="supprimer" />
        <input type="hidden" name="photoId" value={photo.id} />
        {fetcher.data?.message && (
          <p className={styles.erreurGlobale} role="alert">
            {fetcher.data.message}
          </p>
        )}
        <p>
          La photo quitte la réserve, et les emplacements où elle est posée
          redeviennent vides. Cette action est définitive.
        </p>
        <div className={styles.boutonsModale}>
          {/* Le choix sans risque a le focus : Entrée par réflexe ne supprime rien. */}
          <Bouton
            type="button"
            variante="secondaire"
            onClick={onFermer}
            autoFocus
          >
            Annuler
          </Bouton>
          <Bouton
            type="submit"
            variante="destructif"
            enCours={fetcher.state !== "idle"}
          >
            Supprimer
          </Bouton>
        </div>
      </fetcher.Form>
    </Modale>
  );
}

type FetcherComposition = FetcherWithComponents<
  Awaited<ReturnType<typeof actionLivreEnCours>>
>;

function lancerComposition(fetcher: FetcherComposition) {
  void fetcher.submit({ intention: "composer" }, { method: "post" });
}

// Recomposer défait le travail fait dans les intérieures : confirmation, focus sur Annuler.
function ModaleRecomposer({ onFermer }: { onFermer: () => void }) {
  const fetcher = useFetcher<typeof actionLivreEnCours>();
  const reussi = fetcher.state === "idle" && fetcher.data?.reussi;
  useEffect(() => {
    if (reussi) onFermer();
  }, [reussi, onFermer]);

  return (
    <Modale titre="Recomposer le livre ?" onFermer={onFermer}>
      <div className={styles.formulaire}>
        {fetcher.data?.message && (
          <p className={styles.erreurGlobale} role="alert">
            {fetcher.data.message}
          </p>
        )}
        <p>
          Les pages intérieures seront recomposées. Les photos déjà posées
          retournent dans la réserve.
        </p>
        <div className={styles.boutonsModale}>
          <Bouton
            type="button"
            variante="secondaire"
            onClick={onFermer}
            autoFocus
          >
            Annuler
          </Bouton>
          <Bouton
            type="button"
            onClick={() => lancerComposition(fetcher)}
            enCours={fetcher.state !== "idle"}
          >
            Recomposer
          </Bouton>
        </div>
      </div>
    </Modale>
  );
}

// Le bouton qui compose le livre, avec confirmation si des photos sont déjà posées.
function ComposerLeLivre({
  doublesPages,
  nombreDePhotos,
}: {
  doublesPages: DoublePageDuLivre[];
  nombreDePhotos: number;
}) {
  const fetcher = useFetcher<typeof actionLivreEnCours>();
  const [confirmer, setConfirmer] = useState(false);
  const fermer = useCallback(() => setConfirmer(false), []);
  const enCours = fetcher.state !== "idle";
  const dejaCommence = doublesPages.some(
    (d) =>
      d.role === "interieur" &&
      d.emplacement.some((emplacement) => emplacement.photo_id !== null),
  );
  const message = fetcher.state === "idle" ? fetcher.data?.message : null;

  return (
    <>
      <Bouton
        variante="secondaire"
        disabled={nombreDePhotos === 0}
        enCours={enCours}
        onClick={() =>
          dejaCommence ? setConfirmer(true) : lancerComposition(fetcher)
        }
      >
        {enCours ? "Composition…" : "Composer le livre"}
      </Bouton>
      {message && <Banniere titre={message} />}
      {confirmer && <ModaleRecomposer onFermer={fermer} />}
    </>
  );
}

// E7 : l'éditeur, l'import (E5) qui s'ouvre par-dessus à sa propre adresse, et l'export.
export function LivreEnCours() {
  const { projet, fond, doublesPages, gabarits, photos, urlDuPdf } =
    useLoaderData<typeof chargerLivreEnCours>();
  const navigate = useNavigate();
  const ouvrirImport = () => void navigate("import");
  const [aSupprimer, setASupprimer] = useState<Photo | null>(null);
  // Stable : la modale s'en sert dans un effet.
  const fermer = useCallback(() => setASupprimer(null), []);

  return (
    <>
      <div className={styles.entete}>
        <div className={styles.titre}>
          <Link to="/livres" className={styles.retour}>
            ← Mes livres
          </Link>
          <h1>{projet.titre}</h1>
        </div>
        {photos.length > 0 && (
          <Bouton onClick={ouvrirImport}>Importer des photos</Bouton>
        )}
      </div>
      <Editeur
        projetId={projet.id}
        fond={fond}
        doublesPages={doublesPages}
        photos={photos}
        gabarits={gabarits}
        actionsLivre={
          <ComposerLeLivre
            doublesPages={doublesPages}
            nombreDePhotos={photos.length}
          />
        }
        surImporter={ouvrirImport}
        surSupprimerPhoto={(photo) =>
          setASupprimer(photos.find((p) => p.id === photo.id) ?? null)
        }
      />
      {photos.length > 0 && (
        <ExportDuLivre projet={projet} urlDuPdf={urlDuPdf} />
      )}
      {aSupprimer && (
        <ModaleSupprimerPhoto photo={aSupprimer} onFermer={fermer} />
      )}
      <Outlet />
    </>
  );
}
