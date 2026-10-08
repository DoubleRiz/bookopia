import { Extension, Mark, mergeAttributes, Node } from "@tiptap/core";
import {
  Fragment,
  type Mark as MarquePM,
  type Node as NoeudPM,
  Slice,
} from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  ALIGNEMENTS_BLOC,
  type SegmentTexte,
  FAMILLES_POLICES,
} from "@bookopia/shared";

// Les extensions Tiptap de la saisie d'un texte : le strict nécessaire au document du livre.
// Gras, italique, souligné et puces viennent de Tiptap ; ici, ce qui est propre à Bookopia.

export type Famille = (typeof FAMILLES_POLICES)[number];
export type Alignement = (typeof ALIGNEMENTS_BLOC)[number];
export type Reglage = {
  police: Famille | null;
  taille_pt: number | null;
  couleur: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    reglageTexte: {
      // Fusionne les réglages donnés dans ceux de la sélection (ou du texte à venir).
      reglerTexte: (reglage: Partial<Reglage>) => ReturnType;
      aligner: (alignement: Alignement | null) => ReturnType;
    };
  }
}

const SANS_REGLAGE: Reglage = { police: null, taille_pt: null, couleur: null };

// Le corps, la police ou la couleur d'un passage, quand il s'écarte du thème. Un passage sans
// réglage n'a pas la marque : le document ne stocke que les écarts.
export const MarqueReglage = Mark.create({
  name: "reglage",
  addAttributes() {
    return {
      police: { default: null },
      taille_pt: { default: null },
      couleur: { default: null },
    };
  },
  parseHTML: () => [],
  renderHTML: () => ["span", 0],
  addCommands() {
    return {
      reglerTexte:
        (reglage) =>
        ({ state, tr }) => {
          const type = state.schema.marks.reglage;
          if (!type) return false;
          const fusionner = (existante: MarquePM | undefined) => {
            const attrs = {
              ...SANS_REGLAGE,
              ...(existante?.attrs as Partial<Reglage> | undefined),
              ...reglage,
            };
            return Object.values(attrs).every((valeur) => valeur === null)
              ? null
              : type.create(attrs);
          };
          const { empty, ranges, $from } = state.selection;
          if (empty) {
            const courantes = state.storedMarks ?? $from.marks();
            const suivante = fusionner(type.isInSet(courantes) ?? undefined);
            const sans = type.removeFromSet(courantes);
            tr.setStoredMarks(suivante ? suivante.addToSet(sans) : sans);
            return true;
          }
          for (const { $from: debut, $to: fin } of ranges) {
            tr.doc.nodesBetween(debut.pos, fin.pos, (noeud, position) => {
              if (!noeud.isText) return;
              const de = Math.max(position, debut.pos);
              const a = Math.min(position + noeud.nodeSize, fin.pos);
              const suivante = fusionner(
                type.isInSet(noeud.marks) ?? undefined,
              );
              tr.removeMark(de, a, type);
              if (suivante) tr.addMark(de, a, suivante);
            });
          }
          return true;
        },
    };
  },
});

const ALIGNEMENT_CSS: Record<Alignement, string> = {
  gauche: "left",
  centre: "center",
  droite: "right",
};

// L'alignement d'un paragraphe. Sans valeur, il suit le thème.
export const AlignementDuBloc = Extension.create({
  name: "alignementDuBloc",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          alignement: {
            default: null,
            parseHTML: () => null,
            renderHTML: (attributs: { alignement?: Alignement | null }) =>
              attributs.alignement
                ? {
                    style: `text-align: ${ALIGNEMENT_CSS[attributs.alignement]}`,
                  }
                : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      aligner:
        (alignement) =>
        ({ commands }) =>
          commands.updateAttributes("paragraph", { alignement }),
    };
  },
});

// Un élément de liste ne porte qu'un paragraphe : c'est ce que le document du livre sait dire.
export const ElementDeListe = Node.create({
  name: "listItem",
  content: "paragraph",
  defining: true,
  parseHTML: () => [{ tag: "li" }],
  renderHTML: ({ HTMLAttributes }) => [
    "li",
    mergeAttributes(HTMLAttributes),
    0,
  ],
  addKeyboardShortcuts() {
    return { Enter: () => this.editor.commands.splitListItem(this.name) };
  },
});

// Un passage tel que le document du livre le décrit, d'après les marques de son texte.
export function segmentDeNoeud(noeud: NoeudPM): SegmentTexte {
  const segment: SegmentTexte = { texte: noeud.text ?? "" };
  for (const marque of noeud.marks) {
    if (marque.type.name === "bold") segment.gras = true;
    else if (marque.type.name === "italic") segment.italique = true;
    else if (marque.type.name === "underline") segment.souligne = true;
    else if (marque.type.name === "reglage") {
      const { police, taille_pt, couleur } = marque.attrs as Reglage;
      if (police) segment.police = police;
      if (taille_pt) segment.taille_pt = taille_pt;
      if (couleur) segment.couleur = couleur;
    }
  }
  return segment;
}

// Habille chaque passage de sa police, de son corps et de sa couleur, comme le rendu final.
// Le gras et l'italique choisissent un autre fichier de police : jamais de faux gras.
export const HabillageDesPassages = Extension.create<{
  habiller: (segment: SegmentTexte) => string;
}>({
  name: "habillageDesPassages",
  addOptions() {
    return { habiller: () => "" };
  },
  addProseMirrorPlugins() {
    const { habiller } = this.options;
    return [
      new Plugin({
        props: {
          decorations: ({ doc }) => {
            const decorations: Decoration[] = [];
            doc.descendants((noeud, position) => {
              if (!noeud.isText) return;
              decorations.push(
                Decoration.inline(position, position + noeud.nodeSize, {
                  style: habiller(segmentDeNoeud(noeud)),
                }),
              );
            });
            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

// Ce que la mise en lignes partagée dit d'un texte en cours de saisie.
export type Evaluation = {
  deborde: boolean;
  // Hauteur des lignes : un texte qui déborde ne peut que raccourcir.
  hauteur: number;
  longueur: number;
};

const LONGUEUR_MAX = 400;
const EPSILON_MM = 1e-6;

// Un changement n'est accepté que s'il ne rend pas le cadre plus plein qu'il ne tient :
// le cadre ne déborde pas, ou le texte a raccourci. Un texte déjà trop long peut donc toujours
// être réduit.
export function accepte(avant: Evaluation, apres: Evaluation): boolean {
  if (apres.longueur > LONGUEUR_MAX && apres.longueur > avant.longueur) {
    return false;
  }
  return !apres.deborde || apres.hauteur <= avant.hauteur + EPSILON_MM;
}

const MESSAGE_PLEIN = "Le cadre est plein";
const MESSAGE_RACCOURCI = "Le texte collé a été raccourci";

// Le plafond « cadre plein » : la mise en lignes partagée évalue chaque transaction, le navigateur
// ne décide pas. Le collage est du texte brut, raccourci à ce qui tient.
export const LimiteDuCadre = Extension.create<{
  evaluer: (doc: NoeudPM) => Evaluation;
  surMessage: (message: string) => void;
}>({
  name: "limiteDuCadre",
  addOptions() {
    return {
      evaluer: () => ({ deborde: false, hauteur: 0, longueur: 0 }),
      surMessage: () => {},
    };
  },
  addProseMirrorPlugins() {
    const { evaluer, surMessage } = this.options;
    return [
      new Plugin({
        filterTransaction: (transaction, etat) => {
          if (!transaction.docChanged) return true;
          if (accepte(evaluer(etat.doc), evaluer(transaction.doc))) return true;
          surMessage(MESSAGE_PLEIN);
          return false;
        },
        props: {
          handlePaste: (vue, evenement) => {
            evenement.preventDefault();
            const colle = (
              evenement.clipboardData?.getData("text/plain") ?? ""
            ).replace(/\r\n?/g, "\n");
            if (!colle) return true;
            const { state } = vue;
            const { schema, selection } = state;
            const marques = state.storedMarks ?? selection.$from.marks();
            // Un élément de liste n'a qu'un paragraphe : le collage tient sur une ligne.
            const dansUneListe =
              selection.$from.node(-1)?.type.name === "listItem";
            const texte = dansUneListe ? colle.replace(/\n+/g, " ") : colle;
            const avant = evaluer(state.doc);
            const paragraphe = schema.nodes.paragraph;
            if (!paragraphe) return true;

            const essai = (longueur: number) => {
              const paragraphes = texte
                .slice(0, longueur)
                .split("\n")
                .map((ligne) =>
                  paragraphe.create(
                    null,
                    ligne ? schema.text(ligne, marques) : undefined,
                  ),
                );
              return state.tr.replaceSelection(
                new Slice(Fragment.from(paragraphes), 1, 1),
              );
            };
            const tient = (longueur: number) =>
              accepte(avant, evaluer(essai(longueur).doc));

            let bas = 0;
            let haut = texte.length;
            while (bas < haut) {
              const milieu = Math.ceil((bas + haut) / 2);
              if (tient(milieu)) bas = milieu;
              else haut = milieu - 1;
            }
            if (bas === 0) {
              surMessage(MESSAGE_PLEIN);
              return true;
            }
            vue.dispatch(essai(bas).scrollIntoView());
            surMessage(bas < texte.length ? MESSAGE_RACCOURCI : "");
            return true;
          },
        },
      }),
    ];
  },
});
