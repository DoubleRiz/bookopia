import type { ControleExport } from "@bookopia/shared";
import { Link } from "react-router";
import { Banniere } from "../composants/Banniere";
import { Bouton } from "../composants/Bouton";
import type { Etape } from "../export/exporter";
import styles from "./Export.module.css";

export type EtatExport = "demande" | "en_cours" | "disponible" | "echec";

function libelleEtape(etape: Etape | null): string {
  if (!etape) return "Préparation";
  if (etape.nom === "telechargement") {
    return `Téléchargement des photos ${etape.faits} sur ${etape.total}`;
  }
  return etape.nom === "composition" ? "Composition du PDF" : "Enregistrement";
}

function libelleEtat(etat: EtatExport, etape: Etape | null, aJour: boolean) {
  if (etat === "en_cours") return libelleEtape(etape);
  if (etat === "demande") return "Ce livre n'a pas encore été exporté.";
  if (etat === "disponible") {
    return aJour ? "PDF à jour." : "Le livre a changé depuis ce PDF.";
  }
  return "";
}

// E9 : ce que le Créateur voit. Le conteneur (Export.tsx) lui donne l'état et l'action.
// Les contrôles avertissent, ils ne bloquent jamais le bouton (RG-16).
export function VueExport({
  projet,
  controle,
  libelles,
  etat,
  etape,
  message,
  urlDuPdf,
  aJour,
  surExporter,
}: {
  projet: { id: string; titre: string };
  controle: ControleExport;
  libelles: Record<string, string>;
  etat: EtatExport;
  etape: Etape | null;
  message: string | null;
  urlDuPdf: string | null;
  aJour: boolean;
  surExporter: () => void;
}) {
  const enCours = etat === "en_cours";
  const rienAVerifier =
    controle.faibles.length === 0 && controle.vides.length === 0;
  const lien = (doublePageId: string) => (
    <Link to={`/livre/${projet.id}?page=${doublePageId}`}>
      {libelles[doublePageId] ?? "Double page"}
    </Link>
  );

  return (
    <>
      <div className={styles.entete}>
        <Link to={`/livre/${projet.id}`} className={styles.retour}>
          ← {projet.titre}
        </Link>
        <h1>Export</h1>
      </div>

      <section className={styles.section} aria-labelledby="titre-controles">
        <h2 id="titre-controles">Avant l'export</h2>
        {rienAVerifier ? (
          <p className={styles.note}>Aucun point à vérifier.</p>
        ) : (
          <>
            <p className={styles.note}>Ces points n'empêchent pas l'export.</p>
            {controle.faibles.length > 0 && (
              <>
                <h3>Cadres sous 150 DPI</h3>
                <ul className={styles.liste}>
                  {controle.faibles.map((faible) => (
                    <li key={faible.emplacement_id}>
                      {lien(faible.double_page_id)} · {Math.round(faible.dpi)}{" "}
                      DPI
                    </li>
                  ))}
                </ul>
              </>
            )}
            {controle.vides.length > 0 && (
              <>
                <h3>Cadres photo vides</h3>
                <ul className={styles.liste}>
                  {controle.vides.map((vide) => (
                    <li key={vide.emplacement_id}>
                      {lien(vide.double_page_id)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      <section className={styles.section} aria-labelledby="titre-rendu">
        <h2 id="titre-rendu">PDF</h2>
        {etat === "echec" && message && <Banniere titre={message} />}
        <div className={styles.actions}>
          <Bouton onClick={surExporter} enCours={enCours}>
            {urlDuPdf ? "Exporter à nouveau" : "Exporter le PDF"}
          </Bouton>
          {urlDuPdf && (
            <a className={styles.telechargement} href={urlDuPdf}>
              Télécharger le PDF
            </a>
          )}
        </div>
        <p className={styles.etat} aria-live="polite">
          {libelleEtat(etat, etape, aJour)}
        </p>
      </section>
    </>
  );
}
