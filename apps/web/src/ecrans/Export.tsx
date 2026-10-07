import { controlerExport } from "@bookopia/shared";
import { useEffect, useState } from "react";
import {
  data,
  type LoaderFunctionArgs,
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
} from "react-router";
import { z } from "zod";
import { ErreurNonAuthentifie, ErreurReseau } from "../api/client";
import {
  cheminPdf,
  ErreurPdfTropLourd,
  lireDoublesPagesAControler,
  lireExport,
  lireProjetPourExport,
  tailleDuPdf,
  urlDuPdf,
} from "../api/exports";
import { urlsDesVignettes } from "../api/photos";
import { libelleDoublePage } from "../composants/DoublePage";
import { dependancesExport } from "../export/brancher";
import { type Etape, exporter } from "../export/exporter";
import { sousSession } from "../session";
import { type EtatExport, VueExport } from "./VueExport";

const identifiantSchema = z.uuid();

// Un identifiant mal formé, un livre supprimé ou celui d'un autre : la même réponse, introuvable.
export async function chargerExport({ request, params }: LoaderFunctionArgs) {
  return sousSession(request, async () => {
    const identifiant = identifiantSchema.safeParse(params.id);
    const projet = identifiant.success
      ? await lireProjetPourExport(identifiant.data)
      : null;
    if (!projet) {
      throw data("Livre introuvable", { status: 404 });
    }
    const doublesPages = await lireDoublesPagesAControler(projet.id);
    const pdf = await lireExport(projet.id);
    const controle = controlerExport(doublesPages);
    // Une vignette par cadre faible : la photo posée, pour reconnaître le cadre d'un coup d'œil.
    const emplacements = doublesPages.flatMap((d) => d.emplacements);
    const photosFaibles = controle.faibles.flatMap((faible) => {
      const photo = emplacements.find(
        (e) => e.id === faible.emplacement_id,
      )?.photo;
      return photo ? [{ emplacement_id: faible.emplacement_id, photo }] : [];
    });
    const urls = await urlsDesVignettes(
      projet.utilisateur_id,
      projet.id,
      photosFaibles.map(({ photo }) => photo),
    ).catch(() => new Map<string, string>());
    return {
      projet: {
        id: projet.id,
        titre: projet.titre,
        utilisateur_id: projet.utilisateur_id,
      },
      controle,
      vignettes: Object.fromEntries(
        photosFaibles.flatMap(({ emplacement_id, photo }) => {
          const url = urls.get(photo.id);
          return url ? [[emplacement_id, url]] : [];
        }),
      ),
      // Une page par intérieure et par côté, plus la couverture et la 4e.
      nombrePages:
        2 * doublesPages.filter((d) => d.role === "interieur").length + 2,
      libelles: Object.fromEntries(
        doublesPages.map((doublePage) => [
          doublePage.id,
          libelleDoublePage(doublePage.role, doublePage.position),
        ]),
      ),
      urlDuPdf: pdf
        ? await urlDuPdf(
            cheminPdf(projet.utilisateur_id, projet.id, pdf.cle_stockage),
            projet.titre,
          )
        : null,
      pdf: pdf
        ? {
            creeLe: pdf.cree_le,
            taille: await tailleDuPdf(
              projet.utilisateur_id,
              projet.id,
              pdf.cle_stockage,
            ),
          }
        : null,
      // « Exporté et à jour » se calcule : le PDF date d'après la dernière modification du livre.
      aJour: pdf
        ? Date.parse(pdf.cree_le) > Date.parse(projet.modifie_le)
        : false,
    };
  });
}

type Phase =
  | { nom: "repos" }
  | { nom: "export"; etape: Etape | null }
  | { nom: "echec"; message: string };

function messageEchec(probleme: unknown): string {
  if (probleme instanceof ErreurPdfTropLourd) {
    return "Le PDF dépasse 50 Mo et n'a pas pu être enregistré.";
  }
  if (probleme instanceof ErreurReseau) {
    return "Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.";
  }
  return "L'export a échoué. Réessayez dans un instant.";
}

// E9 : le PDF se compose dans le navigateur, l'écran suit les étapes d'exporter().
export function Export() {
  const {
    projet,
    controle,
    vignettes,
    nombrePages,
    libelles,
    urlDuPdf,
    pdf,
    aJour,
  } = useLoaderData<typeof chargerExport>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { revalidate } = useRevalidator();
  const [phase, setPhase] = useState<Phase>({ nom: "repos" });

  const enExport = phase.nom === "export";

  // Fermer l'onglet en plein export perd le rendu ; l'ancien PDF, lui, reste disponible.
  useEffect(() => {
    if (!enExport) return;
    const retenir = (evenement: BeforeUnloadEvent) => {
      evenement.preventDefault();
    };
    window.addEventListener("beforeunload", retenir);
    return () => window.removeEventListener("beforeunload", retenir);
  }, [enExport]);

  const echouer = (probleme: unknown) => {
    if (probleme instanceof ErreurNonAuthentifie) {
      void navigate(`/connexion?retour=${encodeURIComponent(pathname)}`);
      return;
    }
    setPhase({ nom: "echec", message: messageEchec(probleme) });
  };

  const lancerExport = async () => {
    setPhase({ nom: "export", etape: null });
    try {
      await exporter(dependancesExport(projet), {
        onEtape: (etape) => setPhase({ nom: "export", etape }),
      });
      // Le loader relit les contrôles et signe l'adresse du nouveau PDF : on reste « en cours »
      // jusqu'à ce qu'il ait fini, sinon l'écran montre l'ancien état (ou un lien vers un fichier supprimé).
      await revalidate();
      setPhase({ nom: "repos" });
    } catch (probleme) {
      echouer(probleme);
    }
  };

  const etat: EtatExport =
    phase.nom === "export"
      ? "en_cours"
      : phase.nom === "echec"
        ? "echec"
        : urlDuPdf
          ? "disponible"
          : "demande";

  return (
    <VueExport
      projet={projet}
      controle={controle}
      vignettes={vignettes}
      nombrePages={nombrePages}
      libelles={libelles}
      etat={etat}
      etape={phase.nom === "export" ? phase.etape : null}
      message={phase.nom === "echec" ? phase.message : null}
      urlDuPdf={urlDuPdf}
      pdf={pdf}
      aJour={aJour}
      surExporter={() => void lancerExport()}
    />
  );
}
