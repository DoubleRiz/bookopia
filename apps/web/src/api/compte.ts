import { supabase } from "../supabase";
import { ErreurBase, ErreurNonAuthentifie, verifier } from "./client";
import { cheminsSousDossier, enLots, type EntreeDossier } from "./dossiers";

const BUCKETS = ["photos", "exports"] as const;
type Bucket = (typeof BUCKETS)[number];

// L'API Storage rend 100 entrées par page au plus.
const TAILLE_PAGE = 100;
const TAILLE_LOT = 100;

async function listerUnNiveau(
  bucket: Bucket,
  dossier: string,
): Promise<EntreeDossier[]> {
  const entrees: EntreeDossier[] = [];
  for (let decalage = 0; ; decalage += TAILLE_PAGE) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(dossier, { limit: TAILLE_PAGE, offset: decalage });
    if (error) throw new ErreurBase("stockage", error.message);
    entrees.push(...data);
    if (data.length < TAILLE_PAGE) return entrees;
  }
}

// Contrairement à supprimerFichiers (photos.ts), une erreur est levée : la suppression du compte
// doit s'arrêter si un fichier résiste, la base refuserait de toute façon.
async function retirer(bucket: Bucket, chemins: string[]) {
  for (const lot of enLots(chemins, TAILLE_LOT)) {
    const { error } = await supabase.storage.from(bucket).remove(lot);
    if (error) throw new ErreurBase("stockage", error.message);
  }
}

// Le Créateur supprime son compte. Un fichier de Storage ne se supprime pas en SQL (voir la spec) :
// le navigateur vide donc ses deux dossiers par l'API, puis la fonction SQL supprime le compte
// et en cascade ses livres. Elle refuse s'il reste un fichier. Si l'onglet se ferme entre les deux,
// le compte existe encore, sans fichiers : il suffit de recommencer.
export async function supprimerCompte() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new ErreurNonAuthentifie();
  const utilisateurId = data.session.user.id;

  for (const bucket of BUCKETS) {
    const chemins = await cheminsSousDossier(
      (dossier) => listerUnNiveau(bucket, dossier),
      utilisateurId,
    );
    await retirer(bucket, chemins);
  }

  verifier(await supabase.rpc("supprimer_mon_compte"));
  // Le compte n'existe plus : seule la session du navigateur est à effacer.
  await supabase.auth.signOut({ scope: "local" });
}

// Retire les fichiers sans ligne, plus vieux que le délai fixé en base (24 h).
// Silencieuse : un échec laisse les fichiers pour la visite suivante, jamais une erreur à l'écran.
export async function purgerOrphelins() {
  try {
    const orphelins =
      verifier(await supabase.rpc("lister_fichiers_orphelins")) ?? [];
    for (const bucket of BUCKETS) {
      const chemins = orphelins
        .filter((fichier) => fichier.bucket_id === bucket)
        .map((fichier) => fichier.chemin);
      await retirer(bucket, chemins);
    }
  } catch {
    // Rejoué à la prochaine ouverture de la liste des livres.
  }
}
