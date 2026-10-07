import { rendre } from "@bookopia/shared";
import {
  cheminPdf,
  deposerPdf,
  enregistrerExport,
  lireExport,
  lireLivreARendre,
  supprimerPdf,
  telechargerOriginal,
} from "../api/exports";
import { charger } from "./charger";
import type { DependancesExport } from "./exporter";

// Branche l'orchestrateur sur Supabase : exporter.ts reste testable sans réseau.
export function dependancesExport(projet: {
  id: string;
  utilisateur_id: string;
}): DependancesExport {
  const chemin = (cle: string) =>
    cheminPdf(projet.utilisateur_id, projet.id, cle);
  return {
    lireCleExport: async () =>
      (await lireExport(projet.id))?.cle_stockage ?? null,
    charger: async (onAvancement) =>
      charger(
        await lireLivreARendre(projet.id),
        (photo) =>
          telechargerOriginal(
            projet.utilisateur_id,
            projet.id,
            photo.cle_stockage,
          ),
        { onAvancement },
      ),
    rendre,
    nouvelleCle: () => crypto.randomUUID(),
    deposerPdf: (cle, pdf) => deposerPdf(chemin(cle), pdf),
    enregistrerExport: (cle) => enregistrerExport(projet.id, cle),
    supprimerPdf: (cle) => supprimerPdf(chemin(cle)),
  };
}
