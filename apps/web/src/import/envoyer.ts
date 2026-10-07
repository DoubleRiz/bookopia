import { ErreurBase } from "../api/client";
import {
  cheminOriginal,
  cheminVignette,
  creerPhoto,
  deposerFichier,
  supprimerFichiers,
} from "../api/photos";
import { ErreurDoublon, type PhotoAEnvoyer } from "./importer";

// Code PostgreSQL de la violation d'unicité.
const VIOLATION_UNICITE = "23505";

// Un essai de plus : une coupure réseau brève ne doit pas coûter une photo.
async function deposerAvecUnNouvelEssai(
  chemin: string,
  contenu: Blob,
  type: string,
) {
  try {
    await deposerFichier(chemin, contenu, type);
  } catch {
    await deposerFichier(chemin, contenu, type);
  }
}

// Les fichiers d'abord, la ligne ensuite : une interruption laisse au pire un fichier sans ligne,
// jamais une ligne sans fichier. Clé neuve à chaque dépôt : rien n'est jamais écrasé.
export function envoyeur(utilisateurId: string, projetId: string) {
  return async function envoyer(photo: PhotoAEnvoyer) {
    const cle = crypto.randomUUID();
    const original = cheminOriginal(utilisateurId, projetId, cle);
    const vignette = cheminVignette(
      utilisateurId,
      projetId,
      cle,
      photo.formatVignette,
    );
    const deposes: string[] = [];

    try {
      await deposerAvecUnNouvelEssai(original, photo.original, "image/jpeg");
      deposes.push(original);
      await deposerAvecUnNouvelEssai(
        vignette,
        photo.vignette,
        photo.formatVignette === "webp" ? "image/webp" : "image/jpeg",
      );
      deposes.push(vignette);
      await creerPhoto({
        projet_id: projetId,
        cle_stockage: cle,
        format_vignette: photo.formatVignette,
        nom_fichier_origine: photo.nomFichier,
        empreinte_fichier: photo.empreinte,
        largeur_px: photo.largeurPx,
        hauteur_px: photo.hauteurPx,
        prise_le: photo.priseLe?.toISOString() ?? null,
      });
    } catch (erreur) {
      if (deposes.length > 0) {
        await supprimerFichiers(deposes);
      }
      if (erreur instanceof ErreurBase && erreur.code === VIOLATION_UNICITE) {
        throw new ErreurDoublon();
      }
      throw erreur;
    }
  };
}
