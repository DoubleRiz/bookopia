import { themeSchema } from "@bookopia/shared";
import type { LivreLu } from "../export/charger";
import { supabase } from "../supabase";
import { ErreurBase, verifier } from "./client";
import { cheminOriginal } from "./photos";

// Chemin du bucket exports : le premier dossier est le Créateur, c'est ce que vérifie la règle Storage.
export function cheminPdf(
  utilisateurId: string,
  projetId: string,
  cle: string,
) {
  return `${utilisateurId}/${projetId}/${cle}.pdf`;
}

// Le livre à rendre, dans l'ordre du livre. L'énuméré role est déclaré dans cet ordre :
// trier par role puis position donne couverture, intérieures, 4e.
export async function lireLivreARendre(projetId: string): Promise<LivreLu> {
  const projet = verifier(
    await supabase
      .from("projet")
      .select("theme (palette, bordure_cadre, typographie)")
      .eq("id", projetId)
      .single(),
  );
  const doublesPages = verifier(
    await supabase
      .from("double_page")
      .select(
        `emplacement (
          x, y, largeur, hauteur, nature, cadrage_x, cadrage_y, cadrage_zoom,
          style_texte, contenu_texte,
          photo (id, cle_stockage, largeur_px, hauteur_px)
        )`,
      )
      .eq("projet_id", projetId)
      .order("role")
      .order("position")
      .order("indice", { referencedTable: "emplacement" }),
  );
  if (!projet) {
    throw new ErreurBase("introuvable", "Livre introuvable");
  }
  return {
    // Le thème est un JSON que la base ne valide pas : mal formé, il échoue ici,
    // plutôt que de donner un fond noir ou une police de substitution dans le PDF.
    theme: themeSchema.parse(projet.theme),
    doubles_pages: (doublesPages ?? []).map((doublePage) => ({
      emplacements: doublePage.emplacement,
    })),
  };
}

export async function telechargerOriginal(
  utilisateurId: string,
  projetId: string,
  cle: string,
): Promise<Uint8Array> {
  const { data, error } = await supabase.storage
    .from("photos")
    .download(cheminOriginal(utilisateurId, projetId, cle));
  if (error) {
    throw new ErreurBase("stockage", error.message);
  }
  return new Uint8Array(await data.arrayBuffer());
}

// Le bucket refuse un fichier trop lourd (50 Mo) : l'écran le dit autrement qu'une coupure.
export class ErreurPdfTropLourd extends Error {
  constructor() {
    super("Le PDF dépasse la taille autorisée");
    this.name = "ErreurPdfTropLourd";
  }
}

export async function deposerPdf(chemin: string, pdf: Uint8Array) {
  const { error } = await supabase.storage
    .from("exports")
    .upload(chemin, pdf, { contentType: "application/pdf" });
  if (error) {
    if (error.message.includes("maximum allowed size")) {
      throw new ErreurPdfTropLourd();
    }
    throw new ErreurBase("stockage", error.message);
  }
}

// Sans erreur levée : un échec laisse un fichier orphelin, ce que l'architecture accepte.
export async function supprimerPdf(chemin: string) {
  await supabase.storage.from("exports").remove([chemin]);
}

// Le dernier PDF réussi du livre, null s'il n'a jamais été exporté.
export async function lireExport(projetId: string) {
  return verifier(
    await supabase
      .from("export")
      .select("cle_stockage, cree_le")
      .eq("projet_id", projetId)
      .maybeSingle(),
  );
}

// Remplace la ligne : au plus un export par livre (unicité sur projet_id).
export async function enregistrerExport(projetId: string, cle: string) {
  verifier(
    await supabase
      .from("export")
      .upsert(
        { projet_id: projetId, cle_stockage: cle },
        { onConflict: "projet_id" },
      ),
  );
}

// Une heure, comme les vignettes. Le nom proposé au téléchargement est le titre du livre.
export async function urlDuPdf(chemin: string, titre: string) {
  const { data, error } = await supabase.storage
    .from("exports")
    .createSignedUrl(chemin, 3600, { download: `${titre}.pdf` });
  if (error) {
    throw new ErreurBase("stockage", error.message);
  }
  return data.signedUrl;
}
