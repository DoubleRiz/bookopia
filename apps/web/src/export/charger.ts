import type { LivreARendre, Rectangle } from "@bookopia/shared";

// Ce que la base renvoie d'une photo posée : de quoi la retrouver dans Storage et la placer.
export type PhotoPosee = {
  id: string;
  cle_stockage: string;
  largeur_px: number;
  hauteur_px: number;
};

// Le livre tel que lu en base, dans l'ordre : couverture, intérieures, 4e, puis par indice.
export type LivreLu = {
  fond: string;
  doubles_pages: {
    emplacements: (Rectangle & {
      nature: "photo" | "texte";
      photo: PhotoPosee | null;
      cadrage_x: number | null;
      cadrage_y: number | null;
      cadrage_zoom: number | null;
    })[];
  }[];
};

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

// Télécharge les originaux posés et assemble l'entrée du rendu.
// Une photo posée deux fois n'est téléchargée qu'une fois, et ses octets sont partagés :
// le rendu ne l'intègre alors qu'une fois dans le PDF. Une photo introuvable fait tout échouer :
// jamais de PDF avec un trou que le Créateur n'a pas voulu.
export async function charger(
  livre: LivreLu,
  telecharger: (photo: PhotoPosee) => Promise<Uint8Array>,
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
          await avecUnNouvelEssai(() => telecharger(courante)),
        );
      } catch (erreur) {
        echec = true;
        throw erreur;
      }
      onAvancement?.(octets.size, total);
    }
  }

  await Promise.all(
    Array.from({ length: TELECHARGEMENTS_EN_PARALLELE }, () => ouvrier()),
  );

  return {
    fond: livre.fond,
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
        };
      }),
    })),
  };
}
