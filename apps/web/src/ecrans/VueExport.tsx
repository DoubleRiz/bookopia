import {
  type ControleExport,
  HAUTEUR_DOUBLE_PAGE_MM,
  LARGEUR_DOUBLE_PAGE_MM,
} from "@bookopia/shared";
import { Link } from "react-router";
import { Banniere } from "../composants/Banniere";
import { BarreLivre } from "../composants/BarreLivre";
import { Bouton, LienBouton } from "../composants/Bouton";
import type { Etape } from "../export/exporter";
import { progressionExport } from "../export/progression";
import styles from "./Export.module.css";

export type EtatExport = "demande" | "en_cours" | "disponible" | "echec";

function libelleEtape(etape: Etape | null): string {
  if (!etape) return "Préparation";
  if (etape.nom === "telechargement") {
    return `Téléchargement des photos ${etape.faits} sur ${etape.total}`;
  }
  return etape.nom === "composition" ? "Composition du PDF" : "Enregistrement";
}

function libelleEtat(etat: EtatExport, aJour: boolean) {
  if (etat === "demande") return "Ce livre n'a pas encore été exporté.";
  if (etat === "disponible") {
    return aJour ? "PDF à jour." : "Le livre a changé depuis ce PDF.";
  }
  return "";
}

// 214 Mo, 850 Ko : la taille que le Créateur compare à la limite de 50 Mo.
function libelleTaille(octets: number): string {
  const nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
  return octets >= 1_000_000
    ? `${nombre.format(octets / 1_000_000)} Mo`
    : `${nombre.format(Math.max(1, octets / 1000))} Ko`;
}

function libelleDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// Format d'une page, en centimètres : la double page en compte deux côte à côte.
function libelleFormat(nombrePages: number): string {
  const largeur = LARGEUR_DOUBLE_PAGE_MM / 2 / 10;
  const hauteur = HAUTEUR_DOUBLE_PAGE_MM / 10;
  return `${largeur} × ${hauteur} cm · ${nombrePages} pages`;
}

// E9 : ce que le Créateur voit. Le conteneur (Export.tsx) lui donne l'état et l'action.
// Les contrôles avertissent, ils ne bloquent jamais le bouton (RG-16).
export function VueExport({
  projet,
  controle,
  vignettes,
  nombrePages,
  libelles,
  etat,
  etape,
  message,
  urlDuPdf,
  pdf,
  aJour,
  surExporter,
}: {
  projet: { id: string; titre: string };
  controle: ControleExport;
  // Adresse de la vignette de la photo posée, par cadre ; absente si elle n'a pas pu être signée.
  vignettes: Record<string, string>;
  nombrePages: number;
  libelles: Record<string, string>;
  etat: EtatExport;
  etape: Etape | null;
  message: string | null;
  urlDuPdf: string | null;
  pdf: { creeLe: string; taille: number | null } | null;
  aJour: boolean;
  surExporter: () => void;
}) {
  const enCours = etat === "en_cours";
  const nombrePoints = controle.faibles.length + controle.vides.length;
  const progression = progressionExport(etape);

  // Une ligne par cadre : la vignette, la double page (un lien vers l'éditeur) et le détail.
  const ligne = (
    cle: string,
    doublePageId: string,
    vignette: string | undefined,
    detail: string,
  ) => (
    <li key={cle} className={styles.ligne}>
      <span
        className={[styles.vignette, !vignette && styles.vignetteVide]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      >
        {vignette && <img src={vignette} alt="" />}
      </span>
      <div className={styles.texteLigne}>
        <Link
          to={`/livre/${projet.id}?page=${doublePageId}`}
          className={styles.lienLigne}
        >
          {libelles[doublePageId] ?? "Double page"}
          <span className={styles.corriger} aria-hidden="true">
            Corriger →
          </span>
        </Link>
        <span className={styles.detail}>{detail}</span>
      </div>
    </li>
  );

  return (
    <>
      <BarreLivre
        retour={{ vers: `/livre/${projet.id}`, libelle: "Éditeur" }}
        titre={projet.titre}
        etape="exporter"
        importFait
      />
      <div className={styles.page}>
        <div className={styles.entete}>
          <h2>Export pour l'impression</h2>
          <p className={styles.sousTitre}>{libelleFormat(nombrePages)}</p>
        </div>

        <div className={styles.colonnes}>
          <section className={styles.carte} aria-labelledby="titre-controles">
            <header
              className={[
                styles.enteteCarte,
                nombrePoints > 0 && styles.enteteAttention,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <h3 id="titre-controles">
                {nombrePoints === 0
                  ? "Aucun point à vérifier"
                  : nombrePoints === 1
                    ? "1 point à vérifier"
                    : `${nombrePoints} points à vérifier`}
              </h3>
              {nombrePoints > 0 && (
                <p className={styles.note}>
                  Ces points n'empêchent pas l'export.
                </p>
              )}
            </header>
            {controle.faibles.length > 0 && (
              <>
                <h4 className={styles.groupe}>Cadres sous 150 DPI</h4>
                <ul className={styles.liste}>
                  {controle.faibles.map((faible) =>
                    ligne(
                      faible.emplacement_id,
                      faible.double_page_id,
                      vignettes[faible.emplacement_id],
                      `${Math.round(faible.dpi)} DPI`,
                    ),
                  )}
                </ul>
              </>
            )}
            {controle.vides.length > 0 && (
              <>
                <h4 className={styles.groupe}>Cadres photo vides</h4>
                <ul className={styles.liste}>
                  {controle.vides.map((vide) =>
                    ligne(
                      vide.emplacement_id,
                      vide.double_page_id,
                      undefined,
                      "Aucune photo posée",
                    ),
                  )}
                </ul>
              </>
            )}
          </section>

          <div className={styles.colonneDroite}>
            {etat === "echec" && message && <Banniere titre={message} />}

            <section
              className={[styles.carte, styles.rendu, enCours && styles.actif]
                .filter(Boolean)
                .join(" ")}
              aria-labelledby="titre-rendu"
            >
              <h3 id="titre-rendu">
                {enCours
                  ? urlDuPdf
                    ? "Nouveau rendu en cours"
                    : "Rendu en cours"
                  : "PDF"}
              </h3>
              {enCours ? (
                <>
                  <progress
                    className={styles.barre}
                    max={100}
                    value={progression}
                    aria-label="Avancement de l'export"
                  />
                  <p className={[styles.etat, styles.avancement].join(" ")}>
                    <span aria-live="polite">{libelleEtape(etape)}</span>
                    <span>{progression} %</span>
                  </p>
                  <p className={styles.note}>
                    Gardez cet onglet ouvert : le PDF se compose dans votre
                    navigateur.
                  </p>
                </>
              ) : (
                <p className={styles.etat} aria-live="polite">
                  {libelleEtat(etat, aJour)}
                </p>
              )}
            </section>

            {urlDuPdf && (
              <section
                className={styles.carte}
                aria-labelledby="titre-pdf-disponible"
              >
                <div className={styles.titrePdf}>
                  <h3 id="titre-pdf-disponible">
                    {enCours ? "PDF précédent, toujours disponible" : "PDF"}
                  </h3>
                  <span
                    className={[
                      styles.badge,
                      enCours || aJour ? styles.succes : styles.attention,
                    ].join(" ")}
                  >
                    {enCours
                      ? "Conservé"
                      : aJour
                        ? "À jour"
                        : "Livre modifié depuis"}
                  </span>
                </div>
                <div className={styles.fichier}>
                  <span className={styles.icone} aria-hidden="true">
                    PDF
                  </span>
                  <div className={styles.texteLigne}>
                    <span className={styles.nom}>{projet.titre}.pdf</span>
                    {pdf && (
                      <span className={styles.detail}>
                        {pdf.taille !== null &&
                          `${libelleTaille(pdf.taille)} · `}
                        Rendu le {libelleDate(pdf.creeLe)}
                      </span>
                    )}
                  </div>
                  <LienBouton
                    vers={urlDuPdf}
                    externe
                    variante="secondaire"
                    aria-label="Télécharger le PDF"
                  >
                    Télécharger
                  </LienBouton>
                </div>
                {enCours && (
                  <p className={styles.note}>
                    Remplacé seulement quand le nouveau rendu aboutit. En cas
                    d'échec, il reste.
                  </p>
                )}
              </section>
            )}

            <div className={styles.actions}>
              <Bouton onClick={surExporter} enCours={enCours}>
                {urlDuPdf ? "Relancer le rendu" : "Exporter le PDF"}
              </Bouton>
              {nombrePoints > 0 && (
                <p className={styles.note}>
                  {nombrePoints === 1
                    ? "1 point non corrigé sera rendu tel quel."
                    : `${nombrePoints} points non corrigés seront rendus tels quels.`}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
