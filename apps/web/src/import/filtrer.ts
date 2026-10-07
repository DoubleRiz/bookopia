// RG-01 et RG-02 de E5 : écartés dès la sélection, avant tout calcul.
// Le bucket revérifie au dépôt (RG-03), sur les images recréées par le canvas.
export const TAILLE_MAX_OCTETS = 10 * 1024 * 1024;
export const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp"];

export type Refus = { nom: string; raison: "taille" | "format" };

export function filtrer(fichiers: File[]): {
  acceptes: File[];
  refuses: Refus[];
} {
  const acceptes: File[] = [];
  const refuses: Refus[] = [];
  for (const fichier of fichiers) {
    if (!TYPES_ACCEPTES.includes(fichier.type)) {
      refuses.push({ nom: fichier.name, raison: "format" });
    } else if (fichier.size > TAILLE_MAX_OCTETS) {
      refuses.push({ nom: fichier.name, raison: "taille" });
    } else {
      acceptes.push(fichier);
    }
  }
  return { acceptes, refuses };
}
