import ebGaramond500 from "@bookopia/shared/polices/eb-garamond-500.ttf?url";
import ebGaramond400Italique from "@bookopia/shared/polices/eb-garamond-400-italique.ttf?url";
import nunito400 from "@bookopia/shared/polices/nunito-400.ttf?url";
import nunito600 from "@bookopia/shared/polices/nunito-600.ttf?url";
import nunito700 from "@bookopia/shared/polices/nunito-700.ttf?url";
import nunito800 from "@bookopia/shared/polices/nunito-800.ttf?url";
import caveat600 from "@bookopia/shared/polices/caveat-600.ttf?url";
import montserrat400 from "@bookopia/shared/polices/montserrat-400.ttf?url";
import montserrat700 from "@bookopia/shared/polices/montserrat-700.ttf?url";
import montserrat400Italique from "@bookopia/shared/polices/montserrat-400-italique.ttf?url";
import montserrat700Italique from "@bookopia/shared/polices/montserrat-700-italique.ttf?url";
import lora400 from "@bookopia/shared/polices/lora-400.ttf?url";
import lora700 from "@bookopia/shared/polices/lora-700.ttf?url";
import lora400Italique from "@bookopia/shared/polices/lora-400-italique.ttf?url";
import lora700Italique from "@bookopia/shared/polices/lora-700-italique.ttf?url";
import playfairDisplay400 from "@bookopia/shared/polices/playfair-display-400.ttf?url";
import playfairDisplay700 from "@bookopia/shared/polices/playfair-display-700.ttf?url";
import playfairDisplay400Italique from "@bookopia/shared/polices/playfair-display-400-italique.ttf?url";
import playfairDisplay700Italique from "@bookopia/shared/polices/playfair-display-700-italique.ttf?url";
import dancingScript400 from "@bookopia/shared/polices/dancing-script-400.ttf?url";
import dancingScript700 from "@bookopia/shared/polices/dancing-script-700.ttf?url";
import courierPrime400 from "@bookopia/shared/polices/courier-prime-400.ttf?url";
import courierPrime700 from "@bookopia/shared/polices/courier-prime-700.ttf?url";
import courierPrime400Italique from "@bookopia/shared/polices/courier-prime-400-italique.ttf?url";
import courierPrime700Italique from "@bookopia/shared/polices/courier-prime-700-italique.ttf?url";
import greatVibes400 from "@bookopia/shared/polices/great-vibes-400.ttf?url";
import allura400 from "@bookopia/shared/polices/allura-400.ttf?url";
import parisienne400 from "@bookopia/shared/polices/parisienne-400.ttf?url";
import sacramento400 from "@bookopia/shared/polices/sacramento-400.ttf?url";
import alexBrush400 from "@bookopia/shared/polices/alex-brush-400.ttf?url";
import {
  type ClePolice,
  clePolice,
  creerMesure,
  type Mesures,
  type MesureTexte,
  type Typographie,
} from "@bookopia/shared";

// Les polices des livres, servies par l'application : aucun appel à un tiers.
// Les mêmes octets servent à l'écran (FontFace), à la mesure des textes et au PDF.
const URLS: Record<ClePolice, string> = {
  "eb-garamond-500": ebGaramond500,
  "eb-garamond-400-italique": ebGaramond400Italique,
  "nunito-400": nunito400,
  "nunito-600": nunito600,
  "nunito-700": nunito700,
  "nunito-800": nunito800,
  "caveat-600": caveat600,
  "montserrat-400": montserrat400,
  "montserrat-700": montserrat700,
  "montserrat-400-italique": montserrat400Italique,
  "montserrat-700-italique": montserrat700Italique,
  "lora-400": lora400,
  "lora-700": lora700,
  "lora-400-italique": lora400Italique,
  "lora-700-italique": lora700Italique,
  "playfair-display-400": playfairDisplay400,
  "playfair-display-700": playfairDisplay700,
  "playfair-display-400-italique": playfairDisplay400Italique,
  "playfair-display-700-italique": playfairDisplay700Italique,
  "dancing-script-400": dancingScript400,
  "dancing-script-700": dancingScript700,
  "courier-prime-400": courierPrime400,
  "courier-prime-700": courierPrime700,
  "courier-prime-400-italique": courierPrime400Italique,
  "courier-prime-700-italique": courierPrime700Italique,
  "great-vibes-400": greatVibes400,
  "allura-400": allura400,
  "parisienne-400": parisienne400,
  "sacramento-400": sacramento400,
  "alex-brush-400": alexBrush400,
};

export class ErreurPolice extends Error {
  constructor(cle: ClePolice) {
    super(`Police illisible : ${cle}`);
    this.name = "ErreurPolice";
  }
}

const telechargements = new Map<ClePolice, Promise<Uint8Array>>();

// Un fichier par police, téléchargé une fois pour la session. Un échec n'est pas gardé :
// l'appel suivant réessaie.
export function octetsDePolice(cle: ClePolice): Promise<Uint8Array> {
  let telechargement = telechargements.get(cle);
  if (!telechargement) {
    telechargement = fetch(URLS[cle]).then(async (reponse) => {
      if (!reponse.ok) throw new ErreurPolice(cle);
      return new Uint8Array(await reponse.arrayBuffer());
    });
    telechargement.catch(() => telechargements.delete(cle));
    telechargements.set(cle, telechargement);
  }
  return telechargement;
}

// Chaque fichier est sa propre famille CSS : il ne se mêle pas à la Nunito de l'interface,
// et l'écran dessine exactement le fichier que le PDF intègre.
export const familleCss = (cle: ClePolice) => `bookopia-${cle}`;

const pretes = new Map<ClePolice, MesureTexte>();

async function preparer(cle: ClePolice) {
  if (pretes.has(cle)) return;
  const octets = await octetsDePolice(cle);
  try {
    const face = new FontFace(familleCss(cle), octets.slice().buffer);
    document.fonts.add(await face.load());
    pretes.set(cle, creerMesure(octets));
  } catch {
    throw new ErreurPolice(cle);
  }
}

export function policesDuTheme(typographie: Typographie): ClePolice[] {
  return [typographie.titre, typographie.legende].flatMap((police) => {
    const cle = clePolice(police);
    return cle ? [cle] : [];
  });
}

// Prêtes à dessiner et à mesurer : l'éditeur attend ses polices avant d'afficher un texte.
export async function preparerPolices(cles: ClePolice[]): Promise<void> {
  await Promise.all(cles.map(preparer));
}

// Les mesures des polices préparées. Une police non préparée est une erreur de programmation.
export const mesures: Mesures = (cle) => {
  const mesure = pretes.get(cle);
  if (!mesure) throw new Error(`Police non préparée : ${cle}`);
  return mesure;
};
