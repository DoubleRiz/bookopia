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
  urlDuPdf,
} from "../api/exports";
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
    return {
      projet: {
        id: projet.id,
        titre: projet.titre,
        utilisateur_id: projet.utilisateur_id,
      },
      controle: controlerExport(doublesPages),
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
  const { projet, controle, libelles, urlDuPdf, aJour } =
    useLoaderData<typeof chargerExport>();
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
      libelles={libelles}
      etat={etat}
      etape={phase.nom === "export" ? phase.etape : null}
      message={phase.nom === "echec" ? phase.message : null}
      urlDuPdf={urlDuPdf}
      aJour={aJour}
      surExporter={() => void lancerExport()}
    />
  );
}
