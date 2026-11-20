import { supabase } from "../supabase";
import { ErreurBase, ErreurNonAuthentifie, verifier } from "./client";
import { cheminsSousDossier, enLots, type EntreeDossier } from "./dossiers";

const BUCKETS = ["photos", "exports"] as const;
type Bucket = (typeof BUCKETS)[number];

// Entrées demandées par page de liste (le défaut de l'API est 100) : moins d'appels pour un gros dossier.
const TAILLE_PAGE = 1000;
const TAILLE_LOT = 100;

// Une purge par chargement de page : le loader de la liste des livres se relance après chaque
// action (renommer, supprimer, créer), inutile de relister les fichiers à chaque fois.
// Un Créateur qui se reconnecte sans recharger la page attend le prochain chargement.
let purgeLancee = false;

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
  // Le compte n'existe plus : la purge de la prochaine session repartira de zéro.
  purgeLancee = false;
  // Seule la session du navigateur est à effacer. Un échec ici ne change rien au résultat :
  // le compte est supprimé, la modale ne doit pas annoncer le contraire.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // La session locale expirera d'elle-même.
  }
}

// Retire les fichiers sans ligne, plus vieux que le délai fixé en base (24 h).
// Silencieuse : un échec laisse les fichiers pour la visite suivante, jamais une erreur à l'écran.
export async function purgerOrphelins() {
  if (purgeLancee) return;
  purgeLancee = true;
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
    purgeLancee = false;
  }
}
