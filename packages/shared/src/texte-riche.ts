import { z } from "zod";
import { FAMILLES_POLICES } from "./polices";

// Le texte d'un cadre : un document JSON à nous, indépendant de l'éditeur qui le saisit.
// Il ne porte que les écarts par passage : un champ absent suit le thème.
// La base valide la structure (contenu_texte_valide) ; Zod ajoute le catalogue de polices.

// Plafond de texte brut du document, le même que contenu_texte_valide.
export const LONGUEUR_MAX_TEXTE = 400;
export const TAILLE_MIN_PT = 6;
export const TAILLE_MAX_PT = 72;

const couleurSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const segmentSchema = z
  .object({
    texte: z.string().min(1),
    gras: z.boolean().optional(),
    italique: z.boolean().optional(),
    souligne: z.boolean().optional(),
    police: z.enum(FAMILLES_POLICES).optional(),
    taille_pt: z.number().min(TAILLE_MIN_PT).max(TAILLE_MAX_PT).optional(),
    couleur: couleurSchema.optional(),
  })
  .strict();

export const ALIGNEMENTS_BLOC = ["gauche", "centre", "droite"] as const;

const paragrapheSchema = z
  .object({
    type: z.literal("paragraphe"),
    alignement: z.enum(ALIGNEMENTS_BLOC).optional(),
    segments: z.array(segmentSchema),
  })
  .strict();

const listeSchema = z
  .object({
    type: z.literal("liste"),
    elements: z.array(z.array(segmentSchema)),
  })
  .strict();

export const blocSchema = z.discriminatedUnion("type", [
  paragrapheSchema,
  listeSchema,
]);

export const documentTexteSchema = z
  .object({
    version: z.literal(1),
    blocs: z.array(blocSchema),
  })
  .strict();

export type SegmentTexte = z.infer<typeof segmentSchema>;
export type BlocTexte = z.infer<typeof blocSchema>;
export type DocumentTexte = z.infer<typeof documentTexteSchema>;

// Les segments d'un bloc, dans l'ordre : un paragraphe en a une liste, une liste en a une par élément.
export function elementsDuBloc(bloc: BlocTexte): SegmentTexte[][] {
  return bloc.type === "paragraphe" ? [bloc.segments] : bloc.elements;
}

// Le texte sans mise en forme : une ligne par paragraphe ou par élément de liste.
export function texteBrut(document: DocumentTexte): string {
  return document.blocs
    .flatMap(elementsDuBloc)
    .map((segments) => segments.map((segment) => segment.texte).join(""))
    .join("\n");
}

// Ce qui compte pour le plafond de la base : les caractères des segments, sans les séparateurs.
export function longueurTexte(document: DocumentTexte): number {
  return document.blocs
    .flatMap(elementsDuBloc)
    .reduce(
      (total, segments) =>
        total +
        segments.reduce((somme, segment) => somme + segment.texte.length, 0),
      0,
    );
}

// Un document sans lettre ni chiffre visibles est vide : un cadre vidé se range en null.
export function estVide(document: DocumentTexte | null): boolean {
  return document === null || texteBrut(document).trim() === "";
}

// Un texte simple devient un paragraphe par ligne, comme la migration le fait des anciens textes.
export function documentDepuisTexte(texte: string): DocumentTexte | null {
  if (texte === "") return null;
  return {
    version: 1,
    blocs: texte.split("\n").map((ligne) => ({
      type: "paragraphe",
      segments: ligne === "" ? [] : [{ texte: ligne }],
    })),
  };
}

// Lit ce que la base renvoie. Un document mal formé fait échouer ici, au chargement,
// plutôt que produire un PDF sans que le Créateur le sache.
export function lireDocumentTexte(valeur: unknown): DocumentTexte | null {
  return valeur === null || valeur === undefined
    ? null
    : documentTexteSchema.parse(valeur);
}

// Deux documents disent la même chose quand leur JSON est le même : l'ordre des clés est celui
// que les deux côtés produisent, par construction.
export function memeDocument(
  a: DocumentTexte | null,
  b: DocumentTexte | null,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
