// Parcours des dossiers de Storage, sans dépendance au client : testable seul.

// Une entrée de liste de l'API Storage : un dossier n'a pas d'id, un fichier en a un.
export type EntreeDossier = { name: string; id: string | null };

// Liste un niveau d'un dossier (toutes les pages).
export type ListeurDossier = (dossier: string) => Promise<EntreeDossier[]>;

// Tous les fichiers sous un dossier, sous-dossiers compris : l'API Storage ne liste qu'un niveau à la fois.
export async function cheminsSousDossier(
  lister: ListeurDossier,
  dossier: string,
): Promise<string[]> {
  const chemins: string[] = [];
  for (const entree of await lister(dossier)) {
    const chemin = `${dossier}/${entree.name}`;
    if (entree.id === null) {
      chemins.push(...(await cheminsSousDossier(lister, chemin)));
    } else {
      chemins.push(chemin);
    }
  }
  return chemins;
}

// Découpe en lots : une requête de suppression ne porte pas un nombre illimité de fichiers.
export function enLots<T>(elements: T[], taille: number): T[][] {
  const lots: T[][] = [];
  for (let debut = 0; debut < elements.length; debut += taille) {
    lots.push(elements.slice(debut, debut + taille));
  }
  return lots;
}

// Le Créateur tape ce mot pour confirmer la suppression de son compte.
export const MOT_DE_CONFIRMATION = "supprimer";

export function confirmationValide(saisie: string): boolean {
  return saisie.trim().toLowerCase() === MOT_DE_CONFIRMATION;
}
