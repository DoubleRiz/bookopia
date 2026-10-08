import {
  DECALAGE_SOULIGNEMENT,
  dpiEffectif,
  EPAISSEUR_SOULIGNEMENT,
  estVide,
  HAUTEUR_DOUBLE_PAGE_MM,
  LARGEUR_DOUBLE_PAGE_MM,
  MM_PAR_POINT,
  type Mesures,
  niveauResolution,
  placerPhoto,
  type StyleTexte,
  type Theme,
  tronquerPourTenir,
} from "@bookopia/shared";
import {
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useRef,
  useState,
} from "react";
import type { DoublePageDuLivre } from "../api/doublesPages";
import {
  type Cadre,
  chevaucheUnAutre,
  memeCadre,
  pousser,
} from "../editeur/geometrieCadre";
import { familleCss } from "../polices";
import { Poignees, useGestesCadre, useMmParPixel } from "./CadreMobile";
import styles from "./DoublePage.module.css";

// Type du glisser-déposer d'une photo de la réserve : la donnée transportée est son identifiant.
export const TYPE_GLISSER_PHOTO = "application/x-bookopia-photo";

// Ce que l'éditeur branche sur une double page. Sans elle, la double page est un simple dessin
// (miniatures, tests) : ni focus, ni sélection, ni avertissement.
export type InteractionDoublePage = {
  selection: string | null;
  // Le cadre texte dont la saisie est ouverte : c'est la zone de texte qui le montre.
  enSaisie: string | null;
  surSelection: (emplacementId: string | null) => void;
  surSaisir: (emplacementId: string) => void;
  surDepot: (emplacementId: string, photoId: string) => void;
  // Un cadre texte déplacé ou redimensionné, dans les bornes que la base revérifie.
  surPlacer: (emplacementId: string, cadre: Cadre) => void;
  surRecadrer: (emplacementId: string) => void;
  surVider: (emplacementId: string) => void;
};

// Le thème du livre, et de quoi mesurer ses polices. Sans mesures (polices pas encore prêtes
// ou illisibles), les cadres texte sont dessinés vides et ne s'ouvrent pas à la saisie.
export type Habillage = {
  theme: Theme;
  mesures: Mesures | null;
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
  libelle: string;
  detail?: string;
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
  if (niveau === "bon") return null;
  return {
    emplacement,
    niveau,
    libelle:
      niveau === "faible"
        ? "Qualité insuffisante pour l'impression"
        : "Qualité moyenne",
    detail: `${Math.round(dpi)} DPI`,
  };
}

// La pastille est en HTML, posée sur le dessin en pourcentages : son texte garde une taille
// lisible quelle que soit l'échelle de la double page.
function Pastille({ emplacement, niveau, libelle, detail }: Avertissement) {
  return (
    <span
      className={[styles.pastille, styles[niveau]].join(" ")}
      style={{
        left: `${((emplacement.x + 2) / LARGEUR_DOUBLE_PAGE_MM) * 100}%`,
        top: `${((emplacement.y + emplacement.hauteur - 2) / HAUTEUR_DOUBLE_PAGE_MM) * 100}%`,
      }}
      title={detail}
    >
      {libelle}
    </span>
  );
}

const nomDuStyle = (style: StyleTexte) =>
  style === "legende" ? "Légende" : "Titre";

// Ce que montre un cadre texte : ses lignes, coupées comme dans le PDF.
type TexteAffiche =
  | { etat: "indisponible" | "vide" | "masque" }
  | { etat: "ecrit"; dispose: ReturnType<typeof tronquerPourTenir> };

function texteAffiche(
  emplacement: Emplacement,
  habillage: Habillage,
): TexteAffiche {
  const { style_texte } = emplacement;
  if (!style_texte || !habillage.mesures) return { etat: "indisponible" };
  const dispose = tronquerPourTenir(
    { ...emplacement, style_texte },
    habillage.theme,
    habillage.mesures,
  );
  if (dispose.masque) return { etat: "masque" };
  if (estVide(emplacement.contenu_texte)) return { etat: "vide" };
  return { etat: "ecrit", dispose };
}

// Une indication de l'éditeur dans un cadre texte, en police d'interface : elle n'est pas imprimée.
function Indication({
  emplacement,
  children,
}: {
  emplacement: Emplacement;
  children: string;
}) {
  return (
    <text
      className={styles.indication}
      x={emplacement.x + emplacement.largeur / 2}
      y={emplacement.y + emplacement.hauteur / 2}
    >
      {children}
    </text>
  );
}

// Un cadre texte : le cadre en pointillé dans l'éditeur, les lignes du thème, le filet.
// Dans l'éditeur, un cadre vide invite à écrire, un cadre masqué le dit.
function EmplacementTexte({
  emplacement,
  habillage,
  interaction,
}: {
  emplacement: Emplacement;
  habillage: Habillage;
  interaction: InteractionDoublePage | undefined;
}) {
  const affiche = texteAffiche(emplacement, habillage);
  const enSaisie = interaction?.enSaisie === emplacement.id;
  const cadre = (
    <rect
      className={styles.cadreTexte}
      x={emplacement.x}
      y={emplacement.y}
      width={emplacement.largeur}
      height={emplacement.hauteur}
    />
  );

  if (affiche.etat !== "ecrit") {
    return (
      <>
        {cadre}
        {interaction && !enSaisie && affiche.etat === "masque" && (
          <Indication emplacement={emplacement}>Masqué par le thème</Indication>
        )}
        {interaction &&
          !enSaisie &&
          affiche.etat === "vide" &&
          emplacement.style_texte && (
            <Indication emplacement={emplacement}>
              {emplacement.style_texte === "legende"
                ? "Écrire une légende"
                : "Écrire un titre"}
            </Indication>
          )}
      </>
    );
  }

  const { dispose } = affiche;
  const { palette, bordure_cadre } = habillage.theme;
  return (
    <>
      {interaction && cadre}
      {bordure_cadre && (
        <line
          x1={emplacement.x}
          y1={emplacement.y}
          x2={emplacement.x + emplacement.largeur}
          y2={emplacement.y}
          stroke={palette.texte}
          strokeWidth={bordure_cadre.filet_pt * MM_PAR_POINT}
        />
      )}
      {!enSaisie && <TexteDessine dispose={dispose} />}
    </>
  );
}

// Les fragments du texte, tels que le PDF les dessine : chacun dans sa police, sa taille et sa
// couleur, positionné par le module partagé. Le soulignement est un trait sous le fragment.
function TexteDessine({
  dispose,
}: {
  dispose: ReturnType<typeof tronquerPourTenir>;
}) {
  return (
    <>
      {dispose.lignes.flatMap((ligne, rang) =>
        ligne.fragments.map((fragment, indice) => (
          <g key={`${rang}-${indice}`}>
            <text
              className={styles.texte}
              x={fragment.x}
              y={fragment.y}
              fontFamily={familleCss(fragment.police)}
              fontSize={fragment.taille_mm}
              fill={fragment.couleur}
            >
              {fragment.texte}
            </text>
            {fragment.souligne && (
              <line
                x1={fragment.x}
                x2={fragment.x + fragment.largeur}
                y1={fragment.y + fragment.taille_mm * DECALAGE_SOULIGNEMENT}
                y2={fragment.y + fragment.taille_mm * DECALAGE_SOULIGNEMENT}
                stroke={fragment.couleur}
                strokeWidth={fragment.taille_mm * EPAISSEUR_SOULIGNEMENT}
              />
            )}
          </g>
        )),
      )}
    </>
  );
}

// Un texte qui ne tient plus, après un changement de thème : le PDF le coupera.
function avertissementTexte(
  emplacement: Emplacement,
  habillage: Habillage,
): Avertissement | null {
  const affiche = texteAffiche(emplacement, habillage);
  return affiche.etat === "ecrit" && affiche.dispose.deborde
    ? { emplacement, niveau: "faible", libelle: "Texte coupé à l'impression" }
    : null;
}

// La surface d'un cadre texte : un clic le sélectionne, un second clic, Entrée ou un double clic
// ouvre la saisie. Sélectionné, il se déplace en le faisant glisser ou avec les flèches, et se
// redimensionne par ses poignées ou avec Maj + flèches.
function CibleTexte({
  emplacement,
  interaction,
  svg,
  autres,
  surProvisoire,
  mmParPixel,
}: {
  emplacement: Emplacement & { style_texte: StyleTexte };
  interaction: InteractionDoublePage;
  svg: RefObject<SVGSVGElement | null>;
  autres: Cadre[];
  surProvisoire: (provisoire: { id: string; cadre: Cadre } | null) => void;
  mmParPixel: number;
}) {
  const selectionne = interaction.selection === emplacement.id;
  const ecrit = !estVide(emplacement.contenu_texte);
  const cadre: Cadre = {
    x: emplacement.x,
    y: emplacement.y,
    largeur: emplacement.largeur,
    hauteur: emplacement.hauteur,
  };
  const gestes = useGestesCadre({
    svg,
    emplacementId: emplacement.id,
    cadre,
    autres,
    surProvisoire,
    surPlacer: interaction.surPlacer,
  });

  function activer() {
    if (selectionne) interaction.surSaisir(emplacement.id);
    else interaction.surSelection(emplacement.id);
  }

  function clavier(evenement: KeyboardEvent) {
    if (evenement.key === "Enter" || evenement.key === " ") {
      evenement.preventDefault();
      activer();
    } else if (evenement.key === "Escape") {
      interaction.surSelection(null);
    } else if (
      selectionne &&
      (evenement.key === "ArrowLeft" ||
        evenement.key === "ArrowRight" ||
        evenement.key === "ArrowUp" ||
        evenement.key === "ArrowDown")
    ) {
      evenement.preventDefault();
      const suivant = pousser(cadre, evenement.key, evenement.shiftKey);
      if (!memeCadre(suivant, cadre) && !chevaucheUnAutre(suivant, autres)) {
        interaction.surPlacer(emplacement.id, suivant);
      }
    }
  }

  return (
    <>
      <rect
        className={[styles.cible, selectionne && styles.selectionne]
          .filter(Boolean)
          .join(" ")}
        x={emplacement.x}
        y={emplacement.y}
        width={emplacement.largeur}
        height={emplacement.hauteur}
        tabIndex={0}
        role="button"
        aria-pressed={selectionne}
        aria-label={`${nomDuStyle(emplacement.style_texte)} ${emplacement.indice + 1}, ${ecrit ? "écrit" : "vide"}`}
        style={
          selectionne ? { cursor: "move", touchAction: "none" } : undefined
        }
        onClick={(evenement) => {
          evenement.stopPropagation();
          if (!gestes.avalerClic()) activer();
        }}
        onDoubleClick={() => interaction.surSaisir(emplacement.id)}
        onKeyDown={clavier}
        {...(selectionne ? gestes.surElement("corps") : {})}
      />
      {selectionne && (
        <Poignees
          cadre={cadre}
          mmParPixel={mmParPixel}
          ecouteurs={gestes.surElement}
        />
      )}
    </>
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
  habillage,
  photos,
  interaction,
  surcouche,
}: {
  doublePage: DoublePageDuLivre;
  habillage: Habillage;
  photos: Map<string, PhotoAffichee>;
  interaction?: InteractionDoublePage;
  // Posée sur le dessin, dans son repère en pourcentages : la saisie d'un texte.
  surcouche?: ReactNode;
}) {
  const libelle = libelleDoublePage(doublePage.role, doublePage.position);
  const [survole, setSurvole] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const mmParPixel = useMmParPixel(svg);
  // Le cadre texte qu'on est en train de déplacer : il s'affiche à sa position provisoire.
  const [provisoire, setProvisoire] = useState<{
    id: string;
    cadre: Cadre;
  } | null>(null);
  const emplacements = provisoire
    ? doublePage.emplacement.map((emplacement) =>
        emplacement.id === provisoire.id
          ? { ...emplacement, ...provisoire.cadre }
          : emplacement,
      )
    : doublePage.emplacement;
  const photoDe = (emplacement: Emplacement) =>
    emplacement.photo_id ? photos.get(emplacement.photo_id) : undefined;
  const cadresPhoto = emplacements.filter(
    (emplacement) => emplacement.nature === "photo",
  );
  // Les cadres texte qu'on peut ouvrir : un style que le thème montre, des polices prêtes.
  const cadresTexte = emplacements.flatMap((emplacement) => {
    const { style_texte } = emplacement;
    return emplacement.nature === "texte" &&
      style_texte &&
      texteAffiche(emplacement, habillage).etat !== "masque" &&
      habillage.mesures
      ? [{ ...emplacement, style_texte }]
      : [];
  });
  const avertissements = interaction
    ? emplacements.flatMap((emplacement) => {
        const avertissement =
          emplacement.nature === "photo"
            ? avertissementDe(emplacement, photoDe(emplacement))
            : avertissementTexte(emplacement, habillage);
        return avertissement ? [avertissement] : [];
      })
    : [];

  return (
    <figure className={styles.doublePage}>
      <div className={styles.dessin}>
        <svg
          ref={svg}
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
            fill={habillage.theme.palette.fond}
          />
          {emplacements.map((emplacement) =>
            emplacement.nature === "photo" ? (
              <EmplacementPhoto
                key={emplacement.id}
                emplacement={emplacement}
                photo={photoDe(emplacement)}
              />
            ) : (
              <EmplacementTexte
                key={emplacement.id}
                emplacement={emplacement}
                habillage={habillage}
                interaction={interaction}
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
          {interaction &&
            cadresTexte
              .filter((emplacement) => emplacement.id !== interaction.enSaisie)
              // Le cadre sélectionné passe en dernier : ses poignées restent au-dessus des autres cadres.
              .sort(
                (a, b) =>
                  Number(a.id === interaction.selection) -
                  Number(b.id === interaction.selection),
              )
              .map((emplacement) => (
                <CibleTexte
                  key={`cible-${emplacement.id}`}
                  emplacement={emplacement}
                  interaction={interaction}
                  svg={svg}
                  autres={emplacements
                    .filter((autre) => autre.id !== emplacement.id)
                    .map(({ x, y, largeur, hauteur }): Cadre => ({
                      x,
                      y,
                      largeur,
                      hauteur,
                    }))}
                  surProvisoire={setProvisoire}
                  mmParPixel={mmParPixel}
                />
              ))}
        </svg>
        {avertissements.map((avertissement) => (
          <Pastille
            key={`pastille-${avertissement.emplacement.id}`}
            {...avertissement}
          />
        ))}
        {surcouche}
      </div>
      {/* Le libellé est déjà le nom du dessin : la légende ne le répète pas aux lecteurs d'écran. */}
      <figcaption className={styles.libelle} aria-hidden="true">
        {libelle}
      </figcaption>
    </figure>
  );
}
