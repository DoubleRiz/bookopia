import { useEffect, useState } from "react";
import { useLocation, useNavigate, useRevalidator } from "react-router";
import { ErreurNonAuthentifie, ErreurReseau } from "../api/client";
import { ErreurPdfTropLourd, remplirEmplacements } from "../api/exports";
import { Banniere } from "../composants/Banniere";
import { Bouton } from "../composants/Bouton";
import { dependancesExport } from "../export/brancher";
import { type Etape, exporter } from "../export/exporter";
import styles from "./LivreEnCours.module.css";

type Phase =
  | { nom: "repos"; message: string | null }
  | { nom: "remplissage" }
  | { nom: "export"; etape: Etape | null }
  | { nom: "echec"; message: string };

function libelleEtape(etape: Etape | null): string {
  if (!etape || etape.nom === "telechargement") {
    return etape
      ? `Téléchargement des photos ${etape.faits} sur ${etape.total}`
      : "Préparation";
  }
  return etape.nom === "composition" ? "Composition du PDF" : "Enregistrement";
}

function messageEchec(probleme: unknown): string {
  if (probleme instanceof ErreurPdfTropLourd) {
    return "Le PDF dépasse 50 Mo et n'a pas pu être enregistré.";
  }
  if (probleme instanceof ErreurReseau) {
    return "Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.";
  }
  return "L'export a échoué. Réessayez dans un instant.";
}

// Provisoire, en attendant l'éditeur (L6) et l'écran d'export (L7) : remplir les emplacements
// avec la réserve, exporter, télécharger. Le PDF se compose dans le navigateur.
export function ExportDuLivre({
  projet,
  urlDuPdf,
}: {
  projet: { id: string; utilisateur_id: string };
  urlDuPdf: string | null;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { revalidate } = useRevalidator();
  const [phase, setPhase] = useState<Phase>({ nom: "repos", message: null });

  const enExport = phase.nom === "export";
  const occupe = enExport || phase.nom === "remplissage";

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

  const remplir = async () => {
    setPhase({ nom: "remplissage" });
    try {
      const posees = await remplirEmplacements(projet.id);
      setPhase({
        nom: "repos",
        message:
          posees === 0
            ? "Aucun emplacement à remplir"
            : posees === 1
              ? "1 photo posée"
              : `${posees} photos posées`,
      });
    } catch (probleme) {
      echouer(probleme);
    }
  };

  const lancerExport = async () => {
    setPhase({ nom: "export", etape: null });
    try {
      await exporter(dependancesExport(projet), {
        onEtape: (etape) => setPhase({ nom: "export", etape }),
      });
      setPhase({ nom: "repos", message: "PDF prêt" });
      // Le loader relit l'export et signe l'adresse du nouveau PDF.
      void revalidate();
    } catch (probleme) {
      echouer(probleme);
    }
  };

  return (
    <section className={styles.export} aria-labelledby="titre-export">
      <h2 id="titre-export">Export</h2>
      {phase.nom === "echec" && <Banniere titre={phase.message} />}
      <div className={styles.actionsExport}>
        <Bouton
          variante="secondaire"
          onClick={() => void remplir()}
          enCours={phase.nom === "remplissage"}
          disabled={occupe}
        >
          Remplir les emplacements
        </Bouton>
        <Bouton
          onClick={() => void lancerExport()}
          enCours={enExport}
          disabled={occupe}
        >
          Exporter le PDF
        </Bouton>
        {urlDuPdf && !enExport && (
          <a className={styles.telechargement} href={urlDuPdf}>
            Télécharger le PDF
          </a>
        )}
      </div>
      <p className={styles.etat} aria-live="polite">
        {phase.nom === "export"
          ? libelleEtape(phase.etape)
          : phase.nom === "repos"
            ? phase.message
            : null}
      </p>
    </section>
  );
}
