import type { ReactNode } from "react";
import { Link } from "react-router";
import styles from "./BarreLivre.module.css";

type Etape = "importer" | "composer" | "exporter";

const ETAPES: { cle: Etape; libelle: string }[] = [
  { cle: "importer", libelle: "Importer" },
  { cle: "composer", libelle: "Composer" },
  { cle: "exporter", libelle: "Exporter" },
];

// Le suivi des étapes du livre : celles d'avant la courante sont faites, sauf l'import
// tant qu'aucune photo n'est arrivée. « Trier » viendra avec son écran.
function SuiviEtapes({
  courante,
  importFait,
}: {
  courante: Etape;
  importFait: boolean;
}) {
  const rangCourante = ETAPES.findIndex((etape) => etape.cle === courante);
  return (
    <ol className={styles.etapes} aria-label="Étapes du livre">
      {ETAPES.map((etape, rang) => {
        const estCourante = rang === rangCourante;
        const fait =
          rang < rangCourante && (etape.cle !== "importer" || importFait);
        return (
          <li
            key={etape.cle}
            className={[styles.etape, estCourante && styles.etapeCourante]
              .filter(Boolean)
              .join(" ")}
            aria-current={estCourante ? "step" : undefined}
          >
            <span
              className={[styles.rond, fait && styles.rondFait]
                .filter(Boolean)
                .join(" ")}
              aria-hidden="true"
            >
              {fait ? "✓" : rang + 1}
            </span>
            <span className={styles.libelleEtape}>{etape.libelle}</span>
            {fait && <span className={styles.sr}>, terminée</span>}
          </li>
        );
      })}
    </ol>
  );
}

// La barre du haut des écrans plein cadre du livre (E7, E9) : retour, titre, étapes, actions.
export function BarreLivre({
  retour,
  titre,
  statut,
  etape,
  importFait,
  actions,
}: {
  retour: { vers: string; libelle: string };
  titre: string;
  statut?: ReactNode;
  etape: Etape;
  importFait: boolean;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.barre}>
      <div className={styles.gauche}>
        <Link to={retour.vers} className={styles.retour}>
          <span aria-hidden="true">‹ </span>
          {retour.libelle}
        </Link>
        <div className={styles.titre}>
          <h1>{titre}</h1>
          {statut}
        </div>
      </div>
      <SuiviEtapes courante={etape} importFait={importFait} />
      <div className={styles.actions}>{actions}</div>
    </header>
  );
}
