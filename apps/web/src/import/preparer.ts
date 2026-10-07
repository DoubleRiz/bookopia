import exifr from "exifr";
import { type Cadre, tailleOriginal } from "@bookopia/shared";
import type { PhotoPreparee } from "./importer";

const QUALITE_ORIGINAL = 0.9;
const QUALITE_VIGNETTE = 0.8;
const COTE_LONG_VIGNETTE_PX = 480;

// SHA-256 du fichier d'origine, tel que choisi : deux copies du même fichier ont la même empreinte.
export async function calculerEmpreinte(fichier: File): Promise<string> {
  const condensat = await crypto.subtle.digest(
    "SHA-256",
    await fichier.arrayBuffer(),
  );
  return Array.from(new Uint8Array(condensat), (octet) =>
    octet.toString(16).padStart(2, "0"),
  ).join("");
}

// exifr lit le JPEG et le PNG, pas le WebP. Sans date lisible, prise_le reste vide.
async function lireDatePriseDeVue(fichier: File): Promise<Date | null> {
  try {
    const exif = (await exifr.parse(fichier, ["DateTimeOriginal"])) as
      { DateTimeOriginal?: unknown } | undefined;
    const date = exif?.DateTimeOriginal;
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

function encoder(
  canvas: HTMLCanvasElement,
  type: string,
  qualite: number,
): Promise<Blob> {
  return new Promise((resoudre, rejeter) => {
    canvas.toBlob(
      (blob) =>
        blob ? resoudre(blob) : rejeter(new Error("Encodage impossible")),
      type,
      qualite,
    );
  });
}

// Fond blanc : un PNG transparent deviendrait noir en JPEG.
function dessiner(image: ImageBitmap, largeur: number, hauteur: number) {
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const contexte = canvas.getContext("2d");
  if (!contexte) {
    throw new Error("Canvas indisponible");
  }
  contexte.fillStyle = "#fff";
  contexte.fillRect(0, 0, largeur, hauteur);
  contexte.imageSmoothingQuality = "high";
  contexte.drawImage(image, 0, 0, largeur, hauteur);
  return canvas;
}

// Un canvas garde sa mémoire tant qu'il n'est pas ramené à zéro : à 300 photos, ça compte.
function liberer(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

// Prépare une photo pour les cadres du catalogue. Lève si le fichier ne se décode pas (RG-05).
export function preparateur(cadresPhoto: Cadre[]) {
  return async function preparer(fichier: File): Promise<PhotoPreparee> {
    const priseLe = await lireDatePriseDeVue(fichier);
    // createImageBitmap applique l'orientation EXIF : largeur et hauteur sont celles vues à l'écran.
    const image = await createImageBitmap(fichier);
    try {
      const taille = tailleOriginal(image.width, image.height, cadresPhoto);
      const canvasOriginal = dessiner(image, taille.largeur, taille.hauteur);
      const original = await encoder(
        canvasOriginal,
        "image/jpeg",
        QUALITE_ORIGINAL,
      );
      liberer(canvasOriginal);

      const reduction = Math.min(
        1,
        COTE_LONG_VIGNETTE_PX / Math.max(image.width, image.height),
      );
      const canvasVignette = dessiner(
        image,
        Math.max(1, Math.round(image.width * reduction)),
        Math.max(1, Math.round(image.height * reduction)),
      );
      // Un navigateur qui ne sait pas encoder le WebP (Safari) rend un PNG sans prévenir :
      // seul le type du blob le révèle.
      let vignette = await encoder(
        canvasVignette,
        "image/webp",
        QUALITE_VIGNETTE,
      );
      const formatVignette = vignette.type === "image/webp" ? "webp" : "jpeg";
      if (formatVignette === "jpeg") {
        vignette = await encoder(
          canvasVignette,
          "image/jpeg",
          QUALITE_VIGNETTE,
        );
      }
      liberer(canvasVignette);

      return {
        largeurPx: taille.largeur,
        hauteurPx: taille.hauteur,
        priseLe,
        original,
        vignette,
        formatVignette,
      };
    } finally {
      image.close();
    }
  };
}
