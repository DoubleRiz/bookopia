import { type Cadre, definitionGabaritSchema } from "@bookopia/shared";
import { supabase } from "../supabase";
import { ErreurBase, verifier } from "./client";

// Chemins du bucket photos : le premier dossier est le Créateur, c'est ce que vérifie la règle Storage.
export function cheminOriginal(
  utilisateurId: string,
  projetId: string,
  cle: string,
) {
  return `${utilisateurId}/${projetId}/originaux/${cle}.jpg`;
}

export function cheminVignette(
  utilisateurId: string,
  projetId: string,
  cle: string,
  format: "webp" | "jpeg",
) {
  return `${utilisateurId}/${projetId}/vignettes/${cle}.${format === "webp" ? "webp" : "jpg"}`;
}

// null si le livre n'existe pas ou n'est pas à lui : la RLS ne fait pas la différence, l'écran non plus.
export async function lireProjet(projetId: string) {
  return verifier(
    await supabase
      .from("projet")
      .select("id, titre, utilisateur_id, theme (palette)")
      .eq("id", projetId)
      .maybeSingle(),
  );
}

// La réserve, dans l'ordre d'import. Dimensions et dates servent au moteur de gabarits
// et à l'affichage des doubles pages.
export async function listerPhotos(projetId: string) {
  const photos = verifier(
    await supabase
      .from("photo")
      .select(
        "id, cle_stockage, format_vignette, nom_fichier_origine, largeur_px, hauteur_px, prise_le, cree_le",
      )
      .eq("projet_id", projetId)
      .order("cree_le"),
  );
  return photos ?? [];
}

export type PhotoDeLaReserve = Awaited<ReturnType<typeof listerPhotos>>[number];

export async function lireEmpreintes(projetId: string): Promise<Set<string>> {
  const lignes = verifier(
    await supabase
      .from("photo")
      .select("empreinte_fichier")
      .eq("projet_id", projetId),
  );
  return new Set((lignes ?? []).map((ligne) => ligne.empreinte_fichier));
}

// Tous les cadres photo du catalogue, retirés compris : un livre peut encore les porter.
export async function listerCadresPhoto(): Promise<Cadre[]> {
  const gabarits = verifier(
    await supabase.from("gabarit").select("definition"),
  );
  return (gabarits ?? []).flatMap((gabarit) =>
    definitionGabaritSchema
      .parse(gabarit.definition)
      .filter((cadre) => cadre.nature === "photo"),
  );
}

// Une heure : bien plus que le temps d'un écran, assez court pour qu'un lien copié expire.
const DUREE_URL_SIGNEE_S = 3600;

// Le bucket est privé : chaque vignette s'affiche par une URL signée. Une vignette absente
// (fichier orphelin supprimé à la main) n'empêche pas d'afficher les autres.
export async function urlsDesVignettes(
  utilisateurId: string,
  projetId: string,
  photos: PhotoDeLaReserve[],
): Promise<Map<string, string>> {
  if (photos.length === 0) {
    return new Map();
  }
  const chemins = photos.map((photo) =>
    cheminVignette(
      utilisateurId,
      projetId,
      photo.cle_stockage,
      photo.format_vignette,
    ),
  );
  const { data, error } = await supabase.storage
    .from("photos")
    .createSignedUrls(chemins, DUREE_URL_SIGNEE_S);
  if (error) {
    throw new ErreurBase("stockage", error.message);
  }
  const urls = new Map<string, string>();
  data.forEach((signee, rang) => {
    const photo = photos[rang];
    if (photo && signee.signedUrl) {
      urls.set(photo.id, signee.signedUrl);
    }
  });
  return urls;
}

export async function deposerFichier(
  chemin: string,
  contenu: Blob,
  type: string,
) {
  const { error } = await supabase.storage
    .from("photos")
    .upload(chemin, contenu, { contentType: type });
  if (error) {
    throw new ErreurBase("stockage", error.message);
  }
}

// Sans erreur levée : un échec laisse un fichier orphelin, ce que l'architecture accepte.
export async function supprimerFichiers(chemins: string[]) {
  await supabase.storage.from("photos").remove(chemins);
}

// La ligne d'abord, les fichiers ensuite : une interruption laisse au pire des fichiers inutiles,
// jamais une ligne qui désigne un fichier absent. Les emplacements qui la portaient se vident
// par la clé étrangère (on delete set null).
export async function supprimerPhoto(photoId: string) {
  const [photo] =
    verifier(
      await supabase
        .from("photo")
        .delete()
        .eq("id", photoId)
        .select(
          "projet_id, cle_stockage, format_vignette, projet(utilisateur_id)",
        ),
    ) ?? [];
  // La RLS filtre sans erreur : aucune ligne touchée veut dire que la photo n'est pas (ou plus) à lui.
  if (!photo?.projet) {
    throw new ErreurBase("introuvable", "Photo introuvable");
  }
  const { utilisateur_id } = photo.projet;
  await supprimerFichiers([
    cheminOriginal(utilisateur_id, photo.projet_id, photo.cle_stockage),
    cheminVignette(
      utilisateur_id,
      photo.projet_id,
      photo.cle_stockage,
      photo.format_vignette,
    ),
  ]);
}

export async function creerPhoto(ligne: {
  projet_id: string;
  cle_stockage: string;
  format_vignette: "webp" | "jpeg";
  nom_fichier_origine: string;
  empreinte_fichier: string;
  largeur_px: number;
  hauteur_px: number;
  prise_le: string | null;
}) {
  verifier(await supabase.from("photo").insert(ligne));
}
