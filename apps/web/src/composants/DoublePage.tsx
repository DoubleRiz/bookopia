import {
  HAUTEUR_DOUBLE_PAGE_MM,
  LARGEUR_DOUBLE_PAGE_MM,
  placerPhoto,
} from "@bookopia/shared";
import type { DoublePageDuLivre } from "../api/doublesPages";
import styles from "./DoublePage.module.css";

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

// Une double page à l'écran, en millimètres comme les gabarits. Le fond perdu dépasse
// du cadre extérieur et se trouve masqué, comme à la coupe.
export function DoublePage({
  doublePage,
  fond,
  photos,
}: {
  doublePage: DoublePageDuLivre;
  fond: string;
  photos: Map<string, PhotoAffichee>;
}) {
  const libelle = libelleDoublePage(doublePage.role, doublePage.position);
  return (
    <figure className={styles.doublePage}>
      <svg
        className={styles.feuille}
        viewBox={`0 0 ${LARGEUR_DOUBLE_PAGE_MM} ${HAUTEUR_DOUBLE_PAGE_MM}`}
        role="img"
        aria-label={libelle}
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
              photo={
                emplacement.photo_id
                  ? photos.get(emplacement.photo_id)
                  : undefined
              }
            />
          ) : (
            // Le texte arrive avec l'éditeur (L6) : le cadre seul, pour l'instant.
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
      </svg>
      <figcaption className={styles.libelle}>{libelle}</figcaption>
    </figure>
  );
}
