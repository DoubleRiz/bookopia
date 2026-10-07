import {
  type ClePolice,
  clePolice,
  type LivreARendre,
  policeDuStyle,
  type Rectangle,
  type StyleTexte,
  type Theme,
} from "@bookopia/shared";

// Ce que la base renvoie d'une photo posée : de quoi la retrouver dans Storage et la placer.
export type PhotoPosee = {
  id: string;
  cle_stockage: string;
  largeur_px: number;
  hauteur_px: number;
};

// Le livre tel que lu en base, dans l'ordre : couverture, intérieures, 4e, puis par indice.
export type LivreLu = {
  theme: Theme;
  doubles_pages: {
    emplacements: (Rectangle & {
      nature: "photo" | "texte";
      photo: PhotoPosee | null;
      cadrage_x: number | null;
      cadrage_y: number | null;
      cadrage_zoom: number | null;
      style_texte: StyleTexte | null;
      contenu_texte: string | null;
    })[];
  }[];
};

// Les sources du rendu : un original de Storage, un fichier de police servi par l'application.
export type Sources = {
  photo: (photo: PhotoPosee) => Promise<Uint8Array>;
  police: (cle: ClePolice) => Promise<Uint8Array>;
};

// Les polices des textes que le PDF dessinera : un texte vide ou masqué n'en demande aucune.
export function policesUtiles(livre: LivreLu): ClePolice[] {
  const { typographie } = livre.theme;
  const cles = new Set<ClePolice>();
  for (const doublePage of livre.doubles_pages) {
    for (const { style_texte, contenu_texte } of doublePage.emplacements) {
      if (!style_texte || !contenu_texte?.trim()) continue;
      if (typographie.styles_masques.includes(style_texte)) continue;
      const cle = clePolice(policeDuStyle(typographie, style_texte));
      if (cle) cles.add(cle);
    }
  }
  return [...cles];
}

// Peu à la fois : chaque original pèse plusieurs mégaoctets, et tous restent en mémoire jusqu'au rendu.
const TELECHARGEMENTS_EN_PARALLELE = 3;

// Un essai de plus : une coupure réseau brève ne doit pas coûter l'export.
async function avecUnNouvelEssai<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch {
    return action();
  }
}

// Télécharge les originaux posés et les polices des textes, et assemble l'entrée du rendu.
// Une photo posée deux fois n'est téléchargée qu'une fois, et ses octets sont partagés :
// le rendu ne l'intègre alors qu'une fois dans le PDF. Une photo introuvable fait tout échouer :
// jamais de PDF avec un trou que le Créateur n'a pas voulu.
export async function charger(
  livre: LivreLu,
  sources: Sources,
  {
    onAvancement,
  }: { onAvancement?: (faits: number, total: number) => void } = {},
): Promise<LivreARendre> {
  const aTelecharger = new Map<string, PhotoPosee>();
  for (const doublePage of livre.doubles_pages) {
    for (const { photo } of doublePage.emplacements) {
      if (photo) aTelecharger.set(photo.id, photo);
    }
  }

  const total = aTelecharger.size;
  const octets = new Map<string, Uint8Array>();
  const file = [...aTelecharger.values()];
  let echec = false;
  onAvancement?.(0, total);

  async function ouvrier() {
    for (let photo = file.shift(); photo && !echec; photo = file.shift()) {
      const courante = photo;
      try {
        octets.set(
          courante.id,
          await avecUnNouvelEssai(() => sources.photo(courante)),
        );
      } catch (erreur) {
        echec = true;
        throw erreur;
      }
      onAvancement?.(octets.size, total);
    }
  }

  // Les polices pèsent quelques centaines de Ko au plus, déjà en cache si l'éditeur les a affichées.
  const [polices] = await Promise.all([
    Promise.all(
      policesUtiles(livre).map(
        async (cle) =>
          [cle, await avecUnNouvelEssai(() => sources.police(cle))] as const,
      ),
    ),
    Promise.all(
      Array.from({ length: TELECHARGEMENTS_EN_PARALLELE }, () => ouvrier()),
    ),
  ]);

  return {
    theme: livre.theme,
    polices: Object.fromEntries(polices),
    doubles_pages: livre.doubles_pages.map((doublePage) => ({
      emplacements: doublePage.emplacements.map((emplacement) => {
        const { photo } = emplacement;
        const telechargee = photo ? octets.get(photo.id) : undefined;
        return {
          x: emplacement.x,
          y: emplacement.y,
          largeur: emplacement.largeur,
          hauteur: emplacement.hauteur,
          nature: emplacement.nature,
          photo:
            photo && telechargee
              ? {
                  octets: telechargee,
                  largeur_px: photo.largeur_px,
                  hauteur_px: photo.hauteur_px,
                }
              : null,
          // Une photo posée a toujours un cadrage (contrainte de la base) : le neutre n'est qu'un filet.
          cadrage_x: emplacement.cadrage_x ?? 0.5,
          cadrage_y: emplacement.cadrage_y ?? 0.5,
          cadrage_zoom: emplacement.cadrage_zoom ?? 1,
          style_texte: emplacement.style_texte,
          contenu_texte: emplacement.contenu_texte,
        };
      }),
    })),
  };
}
