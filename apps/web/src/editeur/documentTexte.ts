import {
  ALIGNEMENTS_BLOC,
  type BlocTexte,
  type DocumentTexte,
  documentTexteSchema,
  estVide,
  FAMILLES_POLICES,
  type SegmentTexte,
} from "@bookopia/shared";

// L'adaptateur entre le document du livre et celui de Tiptap (ProseMirror), dans les deux sens.
// Tiptap n'est qu'un moyen de saisie : le document ne dépend pas de lui.

type Marque = { type: string; attrs?: Record<string, unknown> };
export type NoeudTiptap = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NoeudTiptap[];
  text?: string;
  marks?: Marque[];
};

function noeudTexte(segment: SegmentTexte): NoeudTiptap {
  const marks: Marque[] = [];
  if (segment.gras) marks.push({ type: "bold" });
  if (segment.italique) marks.push({ type: "italic" });
  if (segment.souligne) marks.push({ type: "underline" });
  if (segment.police || segment.taille_pt || segment.couleur) {
    marks.push({
      type: "reglage",
      attrs: {
        police: segment.police ?? null,
        taille_pt: segment.taille_pt ?? null,
        couleur: segment.couleur ?? null,
      },
    });
  }
  return { type: "text", text: segment.texte, ...(marks.length && { marks }) };
}

const paragraphe = (
  segments: SegmentTexte[],
  alignement?: BlocTexte extends infer B
    ? B extends { alignement?: infer A }
      ? A
      : never
    : never,
): NoeudTiptap => ({
  type: "paragraph",
  ...(alignement && { attrs: { alignement } }),
  ...(segments.length && { content: segments.map(noeudTexte) }),
});

// Un cadre vide donne un document d'un paragraphe vide, ce que Tiptap attend.
export function versTiptap(document: DocumentTexte | null): NoeudTiptap {
  const blocs = document?.blocs ?? [];
  return {
    type: "doc",
    content: blocs.length
      ? blocs.map((bloc): NoeudTiptap =>
          bloc.type === "paragraphe"
            ? paragraphe(bloc.segments, bloc.alignement)
            : {
                type: "bulletList",
                content: bloc.elements.map((segments) => ({
                  type: "listItem",
                  content: [paragraphe(segments)],
                })),
              },
        )
      : [paragraphe([])],
  };
}

function texteEn(noeud: NoeudTiptap): SegmentTexte | null {
  if (noeud.type !== "text" || !noeud.text) return null;
  const segment: SegmentTexte = { texte: noeud.text };
  for (const marque of noeud.marks ?? []) {
    if (marque.type === "bold") segment.gras = true;
    else if (marque.type === "italic") segment.italique = true;
    else if (marque.type === "underline") segment.souligne = true;
    else if (marque.type === "reglage") {
      const { police, taille_pt, couleur } = marque.attrs ?? {};
      if (FAMILLES_POLICES.some((famille) => famille === police)) {
        segment.police = police as (typeof FAMILLES_POLICES)[number];
      }
      if (typeof taille_pt === "number") segment.taille_pt = taille_pt;
      if (typeof couleur === "string") segment.couleur = couleur;
    }
  }
  // Un ordre de clés stable : deux textes identiques donnent le même JSON.
  const { texte, gras, italique, souligne, police, taille_pt, couleur } =
    segment;
  return {
    texte,
    ...(gras && { gras }),
    ...(italique && { italique }),
    ...(souligne && { souligne }),
    ...(police && { police }),
    ...(taille_pt && { taille_pt }),
    ...(couleur && { couleur }),
  };
}

const memeMiseEnForme = (a: SegmentTexte, b: SegmentTexte) =>
  JSON.stringify({ ...a, texte: "" }) === JSON.stringify({ ...b, texte: "" });

// Deux passages voisins de même mise en forme n'en font qu'un.
function segmentsDe(noeud: NoeudTiptap): SegmentTexte[] {
  const segments: SegmentTexte[] = [];
  for (const enfant of noeud.content ?? []) {
    const segment = texteEn(enfant);
    if (!segment) continue;
    const dernier = segments.at(-1);
    if (dernier && memeMiseEnForme(dernier, segment)) {
      dernier.texte += segment.texte;
    } else {
      segments.push(segment);
    }
  }
  return segments;
}

const ALIGNEMENTS: readonly string[] = ALIGNEMENTS_BLOC;

// Le document du livre ; null pour un cadre sans texte visible. Un contenu que le schéma refuse
// (police inconnue, corps hors bornes) lève une erreur : rien d'invalide n'est écrit.
export function depuisTiptap(racine: NoeudTiptap): DocumentTexte | null {
  const blocs: BlocTexte[] = (racine.content ?? []).flatMap(
    (noeud): BlocTexte[] => {
      if (noeud.type === "paragraph") {
        const alignement = noeud.attrs?.alignement;
        return [
          {
            type: "paragraphe",
            ...(typeof alignement === "string" &&
              ALIGNEMENTS.includes(alignement) && {
                alignement: alignement as (typeof ALIGNEMENTS_BLOC)[number],
              }),
            segments: segmentsDe(noeud),
          },
        ];
      }
      if (noeud.type === "bulletList") {
        return [
          {
            type: "liste",
            elements: (noeud.content ?? []).map((element) =>
              segmentsDe(element.content?.[0] ?? { type: "paragraph" }),
            ),
          },
        ];
      }
      return [];
    },
  );
  const document = documentTexteSchema.parse({ version: 1, blocs });
  return estVide(document) ? null : document;
}
