import {
  dpiEffectif,
  HAUTEUR_DOUBLE_PAGE_MM,
  LARGEUR_DOUBLE_PAGE_MM,
  niveauResolution,
  placerPhoto,
} from "@bookopia/shared";
import { type DragEvent, type KeyboardEvent, useState } from "react";
import type { DoublePageDuLivre } from "../api/doublesPages";
import styles from "./DoublePage.module.css";

// Type du glisser-déposer d'une photo de la réserve : la donnée transportée est son identifiant.
export const TYPE_GLISSER_PHOTO = "application/x-bookopia-photo";

// Ce que l'éditeur branche sur une double page. Sans elle, la double page est un simple dessin
// (miniatures, tests) : ni focus, ni sélection, ni avertissement.
export type InteractionDoublePage = {
  selection: string | null;
  surSelection: (emplacementId: string | null) => void;
  surDepot: (emplacementId: string, photoId: string) => void;
  surRecadrer: (emplacementId: string) => void;
  surVider: (emplacementId: string) => void;
};

export type PhotoAffichee = {
  // URL signée de la vignette ; absente si la vignette n'a pas pu être signée.
  url?: string;
  largeur_px: number;
  hauteur_px: number;
};

// L'intérieure n porte les pages 2n et 2n + 1 : la page 1 est la couverture.
export function libelleDoublePage(
  role: DoublePageDuLivre["role"],
  position: number | null,
): string {
  if (role === "couverture") return "Couverture";
  if (role === "quatrieme") return "Quatrième de couverture";
  const n = position ?? 0;
  return `Pages ${2 * n} et ${2 * n + 1}`;
}

type Emplacement = DoublePageDuLivre["emplacement"][number];

// Une photo posée : la vignette entière, étirée aux dimensions de l'original, dans un svg
// dont le viewBox est la zone visible. Le PDF calcule la même zone avec placerPhoto.
function EmplacementPhoto({
  emplacement,
  photo,
}: {
  emplacement: Emplacement;
  photo: PhotoAffichee | undefined;
}) {
  const { cadrage_x, cadrage_y, cadrage_zoom } = emplacement;
  if (
    !photo?.url ||
    cadrage_x === null ||
    cadrage_y === null ||
    cadrage_zoom === null
  ) {
    return (
      <rect
        className={styles.cadreVide}
        x={emplacement.x}
        y={emplacement.y}
        width={emplacement.largeur}
        height={emplacement.hauteur}
      />
    );
  }
  const { cadre, zone } = placerPhoto(
    { ...emplacement, cadrage_x, cadrage_y, cadrage_zoom },
    photo,
  );
  return (
    <svg
      x={cadre.x}
      y={cadre.y}
      width={cadre.largeur}
      height={cadre.hauteur}
      viewBox={`${zone.x} ${zone.y} ${zone.largeur} ${zone.hauteur}`}
      preserveAspectRatio="none"
    >
      <image
        href={photo.url}
        width={photo.largeur_px}
        height={photo.hauteur_px}
        preserveAspectRatio="none"
      />
    </svg>
  );
}

function estPosee(emplacement: Emplacement): boolean {
  return emplacement.photo_id !== null && emplacement.cadrage_zoom !== null;
}

type Avertissement = {
  emplacement: Emplacement;
  niveau: "moyen" | "faible";
  dpi: number;
};

// Avertissement de résolution (RG-16) : jamais bloquant. Rien à partir de 300 DPI.
function avertissementDe(
  emplacement: Emplacement,
  photo: PhotoAffichee | undefined,
): Avertissement | null {
  const { cadrage_x, cadrage_y, cadrage_zoom } = emplacement;
  if (
    !photo ||
    emplacement.photo_id === null ||
    cadrage_x === null ||
    cadrage_y === null ||
    cadrage_zoom === null
  ) {
    return null;
  }
  const dpi = dpiEffectif(
    { ...emplacement, cadrage_x, cadrage_y, cadrage_zoom },
    photo,
  );
  const niveau = niveauResolution(dpi);
  return niveau === "bon" ? null : { emplacement, niveau, dpi };
}

// La pastille est en HTML, posée sur le dessin en pourcentages : son texte garde une taille
// lisible quelle que soit l'échelle de la double page.
function PastilleResolution({ emplacement, niveau, dpi }: Avertissement) {
  return (
    <span
      className={[styles.pastille, styles[niveau]].join(" ")}
      style={{
        left: `${((emplacement.x + 2) / LARGEUR_DOUBLE_PAGE_MM) * 100}%`,
        top: `${((emplacement.y + emplacement.hauteur - 2) / HAUTEUR_DOUBLE_PAGE_MM) * 100}%`,
      }}
      title={`${Math.round(dpi)} DPI`}
    >
      {niveau === "faible"
        ? "Qualité insuffisante pour l'impression"
        : "Qualité moyenne"}
    </span>
  );
}

// La surface qu'on clique, qu'on atteint au clavier et sur laquelle on dépose une photo.
// Posée par-dessus le dessin, aux dimensions du cadre (sans fond perdu).
function CibleEmplacement({
  emplacement,
  interaction,
  survole,
  surSurvol,
}: {
  emplacement: Emplacement;
  interaction: InteractionDoublePage;
  survole: boolean;
  surSurvol: (emplacementId: string | null) => void;
}) {
  const selectionne = interaction.selection === emplacement.id;
  const posee = estPosee(emplacement);

  function clavier(evenement: KeyboardEvent) {
    if (evenement.key === "Enter" || evenement.key === " ") {
      evenement.preventDefault();
      if (selectionne && posee) {
        interaction.surRecadrer(emplacement.id);
      } else {
        interaction.surSelection(emplacement.id);
      }
    } else if (
      (evenement.key === "Delete" || evenement.key === "Backspace") &&
      posee
    ) {
      evenement.preventDefault();
      interaction.surVider(emplacement.id);
    } else if (evenement.key === "Escape") {
      interaction.surSelection(null);
    }
  }

  function survol(evenement: DragEvent) {
    if (!evenement.dataTransfer.types.includes(TYPE_GLISSER_PHOTO)) return;
    evenement.preventDefault();
    evenement.dataTransfer.dropEffect = "copy";
    if (!survole) surSurvol(emplacement.id);
  }

  function depot(evenement: DragEvent) {
    const photoId = evenement.dataTransfer.getData(TYPE_GLISSER_PHOTO);
    surSurvol(null);
    if (!photoId) return;
    evenement.preventDefault();
    interaction.surDepot(emplacement.id, photoId);
  }

  return (
    <rect
      className={[
        styles.cible,
        selectionne && styles.selectionne,
        survole && styles.survole,
      ]
        .filter(Boolean)
        .join(" ")}
      x={emplacement.x}
      y={emplacement.y}
      width={emplacement.largeur}
      height={emplacement.hauteur}
      tabIndex={0}
      role="button"
      aria-pressed={selectionne}
      aria-label={`Cadre ${emplacement.indice + 1}, ${posee ? "photo posée" : "vide"}`}
      onClick={(evenement) => {
        evenement.stopPropagation();
        interaction.surSelection(emplacement.id);
      }}
      onDoubleClick={() => posee && interaction.surRecadrer(emplacement.id)}
      onKeyDown={clavier}
      onDragOver={survol}
      onDragLeave={() => surSurvol(null)}
      onDrop={depot}
    />
  );
}

// Une double page à l'écran, en millimètres comme les gabarits. Le fond perdu dépasse
// du cadre extérieur et se trouve masqué, comme à la coupe.
export function DoublePage({
  doublePage,
  fond,
  photos,
  interaction,
}: {
  doublePage: DoublePageDuLivre;
  fond: string;
  photos: Map<string, PhotoAffichee>;
  interaction?: InteractionDoublePage;
}) {
  const libelle = libelleDoublePage(doublePage.role, doublePage.position);
  const [survole, setSurvole] = useState<string | null>(null);
  const photoDe = (emplacement: Emplacement) =>
    emplacement.photo_id ? photos.get(emplacement.photo_id) : undefined;
  const cadresPhoto = doublePage.emplacement.filter(
    (emplacement) => emplacement.nature === "photo",
  );
  const avertissements = interaction
    ? cadresPhoto.flatMap((emplacement) => {
        const avertissement = avertissementDe(
          emplacement,
          photoDe(emplacement),
        );
        return avertissement ? [avertissement] : [];
      })
    : [];

  return (
    <figure className={styles.doublePage}>
      <div className={styles.dessin}>
        <svg
          className={styles.feuille}
          viewBox={`0 0 ${LARGEUR_DOUBLE_PAGE_MM} ${HAUTEUR_DOUBLE_PAGE_MM}`}
          role={interaction ? "group" : "img"}
          aria-label={libelle}
          onClick={
            interaction ? () => interaction.surSelection(null) : undefined
          }
        >
          <rect
            width={LARGEUR_DOUBLE_PAGE_MM}
            height={HAUTEUR_DOUBLE_PAGE_MM}
            fill={fond}
          />
          {doublePage.emplacement.map((emplacement) =>
            emplacement.nature === "photo" ? (
              <EmplacementPhoto
                key={emplacement.id}
                emplacement={emplacement}
                photo={photoDe(emplacement)}
              />
            ) : (
              // Le texte arrive avec l'éditeur (L6, 6c) : le cadre seul, pour l'instant.
              <rect
                key={emplacement.id}
                className={styles.cadreTexte}
                x={emplacement.x}
                y={emplacement.y}
                width={emplacement.largeur}
                height={emplacement.hauteur}
              />
            ),
          )}
          <line
            className={styles.pli}
            x1={LARGEUR_DOUBLE_PAGE_MM / 2}
            y1={0}
            x2={LARGEUR_DOUBLE_PAGE_MM / 2}
            y2={HAUTEUR_DOUBLE_PAGE_MM}
          />
          {avertissements.map(({ emplacement, niveau }) => (
            <rect
              key={`avertissement-${emplacement.id}`}
              className={[styles.surlignage, styles[niveau]].join(" ")}
              x={emplacement.x}
              y={emplacement.y}
              width={emplacement.largeur}
              height={emplacement.hauteur}
            />
          ))}
          {interaction &&
            cadresPhoto.map((emplacement) => (
              <CibleEmplacement
                key={`cible-${emplacement.id}`}
                emplacement={emplacement}
                interaction={interaction}
                survole={survole === emplacement.id}
                surSurvol={setSurvole}
              />
            ))}
        </svg>
        {avertissements.map((avertissement) => (
          <PastilleResolution
            key={`pastille-${avertissement.emplacement.id}`}
            {...avertissement}
          />
        ))}
      </div>
      {/* Le libellé est déjà le nom du dessin : la légende ne le répète pas aux lecteurs d'écran. */}
      <figcaption className={styles.libelle} aria-hidden="true">
        {libelle}
      </figcaption>
    </figure>
  );
}
