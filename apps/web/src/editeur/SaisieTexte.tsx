import {
  clePolice,
  DECALAGE_SOULIGNEMENT,
  type DocumentTexte,
  disposerTexte,
  EPAISSEUR_SOULIGNEMENT,
  HAUTEUR_DOUBLE_PAGE_MM,
  INTERLIGNE,
  LARGEUR_DOUBLE_PAGE_MM,
  longueurTexte,
  type Mesures,
  MM_PAR_POINT,
  policeDuStyle,
  type SegmentTexte,
  type StyleTexte,
  styleDuSegment,
  type Theme,
} from "@bookopia/shared";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { type FocusEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { EmplacementDuLivre } from "../api/doublesPages";
import { familleCss } from "../polices";
import { BarreMiseEnForme } from "./BarreMiseEnForme";
import { depuisTiptap, versTiptap } from "./documentTexte";
import styles from "./Editeur.module.css";
import {
  AlignementDuBloc,
  ElementDeListe,
  type Evaluation,
  HabillageDesPassages,
  LimiteDuCadre,
  MarqueReglage,
} from "./extensionsTexte";

// Ce que les écouteurs de l'éditeur, créés une fois, doivent lire : le contexte et les rappels
// du dernier rendu.
class Courant {
  constructor(
    public contexte: Contexte,
    public rappels: {
      surChangement: (contenu: DocumentTexte | null) => void;
      surFin: () => void;
    },
  ) {}

  // Les caractères du dernier texte vu : seul un texte raccourci fait taire « Le cadre est plein ».
  longueur = 0;

  // Garde la longueur du texte ; vrai quand le texte vient de raccourcir.
  retenirLongueur(longueur: number): boolean {
    const raccourci = longueur < this.longueur;
    this.longueur = longueur;
    return raccourci;
  }

  lireContexte() {
    return this.contexte;
  }

  mettreAJour(contexte: Contexte, rappels: Courant["rappels"]) {
    this.contexte = contexte;
    this.rappels = rappels;
  }
}

// L'alignement de départ : celui du thème, sauf pour « extérieur », qui suit la page où se
// trouve le cadre.
function alignementCss(
  theme: Theme,
  emplacement: { x: number; largeur: number },
): "left" | "center" | "right" {
  const { alignement } = theme.typographie;
  if (alignement === "gauche") return "left";
  if (alignement === "centre") return "center";
  return emplacement.x + emplacement.largeur / 2 < LARGEUR_DOUBLE_PAGE_MM / 2
    ? "left"
    : "right";
}

const enPourcentage = (mm: number, total: number) => `${(mm / total) * 100}%`;

// Des millimètres du dessin en largeur du conteneur : la saisie suit l'échelle de la double page.
const enCqw = (mm: number) => `${(mm / LARGEUR_DOUBLE_PAGE_MM) * 100}cqw`;

type Contexte = {
  emplacement: EmplacementDuLivre & { style_texte: StyleTexte };
  theme: Theme;
  mesures: Mesures;
};

// Le style CSS d'un passage : le même fichier de police, le même corps et la même couleur que le
// dessin final. Le soulignement reprend la place et l'épaisseur du trait du PDF.
function styleCss({ theme, emplacement }: Contexte, segment: SegmentTexte) {
  const passage = styleDuSegment(segment, theme, emplacement.style_texte);
  return [
    `font-family: ${familleCss(passage.police)}`,
    `font-size: ${enCqw(passage.taille_mm)}`,
    `color: ${passage.couleur}`,
    passage.souligne
      ? `text-decoration: underline; text-decoration-thickness: ${EPAISSEUR_SOULIGNEMENT}em; text-underline-offset: ${DECALAGE_SOULIGNEMENT}em`
      : "text-decoration: none",
  ].join("; ");
}

// L'éditeur de texte posé sur un cadre, à la police et à l'échelle du dessin : un clic le place,
// la frappe se fait là, comme sur le papier. Le cadre ne peut pas déborder : la mise en lignes
// est celle du PDF. Un texte déjà trop long (après un changement de thème) peut toujours être
// raccourci. La barre de mise en forme se range dans `barre`, au-dessus de la double page.
export function SaisieTexte({
  emplacement,
  theme,
  mesures,
  barre,
  surChangement,
  surFin,
}: Contexte & {
  barre: HTMLElement | null;
  surChangement: (contenu: DocumentTexte | null) => void;
  surFin: () => void;
}) {
  const [annonce, setAnnonce] = useState("");
  const [contenuDeDepart] = useState(() =>
    versTiptap(emplacement.contenu_texte),
  );
  const zone = useRef<HTMLDivElement>(null);

  // Les extensions et les écouteurs sont créés une fois : ils lisent le contexte courant ici.
  const [courant] = useState(
    () =>
      new Courant({ emplacement, theme, mesures }, { surChangement, surFin }),
  );
  useEffect(() => {
    courant.mettreAJour(
      { emplacement, theme, mesures },
      { surChangement, surFin },
    );
  });

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        dropcursor: false,
        hardBreak: false,
        heading: false,
        horizontalRule: false,
        link: false,
        listItem: false,
        orderedList: false,
        strike: false,
        trailingNode: false,
      }),
      ElementDeListe,
      MarqueReglage,
      AlignementDuBloc,
      HabillageDesPassages.configure({
        habiller: (segment) => styleCss(courant.lireContexte(), segment),
      }),
      LimiteDuCadre.configure({
        evaluer: (doc): Evaluation => {
          const {
            emplacement: cadre,
            theme: habillage,
            mesures: mesure,
          } = courant.lireContexte();
          try {
            const document = depuisTiptap(doc.toJSON());
            const dispose = disposerTexte(
              { ...cadre, contenu_texte: document },
              habillage,
              mesure,
            );
            return {
              deborde: dispose.deborde,
              hauteur: dispose.lignes.reduce(
                (somme, ligne) => somme + ligne.hauteur,
                0,
              ),
              longueur: document ? longueurTexte(document) : 0,
            };
          } catch {
            // Un document que le schéma refuse ne se mesure pas : la transaction passe,
            // l'écriture en base le refusera.
            return { deborde: false, hauteur: 0, longueur: 0 };
          }
        },
        surMessage: setAnnonce,
      }),
    ],
    [courant],
  );

  const editeur = useEditor({
    extensions,
    content: contenuDeDepart,
    autofocus: "end",
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": `${emplacement.style_texte === "legende" ? "Légende" : "Titre"} ${emplacement.indice + 1}`,
        spellcheck: "true",
      },
      handleKeyDown: (_, evenement) => {
        if (evenement.key !== "Escape") return false;
        evenement.preventDefault();
        evenement.stopPropagation();
        courant.rappels.surFin();
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      try {
        const contenu = depuisTiptap(editor.getJSON());
        const longueur = contenu ? longueurTexte(contenu) : 0;
        if (courant.retenirLongueur(longueur)) setAnnonce("");
        courant.rappels.surChangement(contenu);
      } catch {
        // Un document invalide n'est pas écrit : l'éditeur garde la main, rien ne part en base.
      }
    },
  });

  // Le focus peut passer du texte à la barre sans fermer la saisie : seule la sortie des deux la ferme.
  function sortie(evenement: FocusEvent) {
    const suivant = evenement.relatedTarget;
    if (
      suivant instanceof Node &&
      (zone.current?.contains(suivant) || barre?.contains(suivant))
    ) {
      return;
    }
    courant.rappels.surFin();
  }

  const police = policeDuStyle(theme.typographie, emplacement.style_texte);
  const cle = clePolice(police);
  const taille_mm = police.taille_pt * MM_PAR_POINT;
  const ancrageBas = theme.typographie.ancrage === "bas";

  return (
    <div className={styles.saisieRacine} onBlur={sortie}>
      <div
        ref={zone}
        className={styles.saisieTexte}
        style={{
          left: enPourcentage(emplacement.x, LARGEUR_DOUBLE_PAGE_MM),
          top: enPourcentage(emplacement.y, HAUTEUR_DOUBLE_PAGE_MM),
          width: enPourcentage(emplacement.largeur, LARGEUR_DOUBLE_PAGE_MM),
          height: enPourcentage(emplacement.hauteur, HAUTEUR_DOUBLE_PAGE_MM),
          justifyContent: ancrageBas ? "flex-end" : "flex-start",
          fontFamily: cle ? familleCss(cle) : undefined,
          fontSize: enCqw(taille_mm),
          lineHeight: INTERLIGNE,
          textAlign: alignementCss(theme, emplacement),
          color: theme.palette.texte,
          // Le retrait des puces suit celui du rendu final.
          ["--retrait-puce" as string]: enCqw(5),
        }}
      >
        <EditorContent editor={editeur} />
      </div>
      <span
        className={styles.annonceSaisie}
        // Pas de rôle status : l'éditeur en a déjà un, le statut d'enregistrement.
        aria-live="polite"
        style={{
          left: enPourcentage(emplacement.x, LARGEUR_DOUBLE_PAGE_MM),
          top: enPourcentage(
            emplacement.y + emplacement.hauteur,
            HAUTEUR_DOUBLE_PAGE_MM,
          ),
        }}
      >
        {annonce}
      </span>
      {barre &&
        editeur &&
        createPortal(
          <BarreMiseEnForme
            editor={editeur}
            theme={theme}
            styleTexte={emplacement.style_texte}
          />,
          barre,
        )}
    </div>
  );
}
