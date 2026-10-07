import type { LivreARendre } from "@bookopia/shared";

export type DependancesExport = {
  // Clé du PDF actuel du livre, null s'il n'a jamais été exporté.
  lireCleExport: () => Promise<string | null>;
  charger: (
    onAvancement: (faits: number, total: number) => void,
  ) => Promise<LivreARendre>;
  rendre: (livre: LivreARendre) => Promise<Uint8Array>;
  nouvelleCle: () => string;
  deposerPdf: (cle: string, pdf: Uint8Array) => Promise<void>;
  enregistrerExport: (cle: string) => Promise<void>;
  supprimerPdf: (cle: string) => Promise<void>;
};

export type Etape =
  | { nom: "telechargement"; faits: number; total: number }
  | { nom: "composition" }
  | { nom: "enregistrement" };

// L'export réussit en entier ou n'écrit rien. Le fichier d'abord, la ligne ensuite :
// la ligne export désigne toujours un fichier qui existe, et l'ancien PDF reste disponible
// jusqu'à ce que le nouveau soit enregistré. Renvoie la clé du nouveau PDF.
export async function exporter(
  dependances: DependancesExport,
  { onEtape }: { onEtape?: (etape: Etape) => void } = {},
): Promise<string> {
  const ancienne = await dependances.lireCleExport();
  const livre = await dependances.charger((faits, total) =>
    onEtape?.({ nom: "telechargement", faits, total }),
  );

  onEtape?.({ nom: "composition" });
  const pdf = await dependances.rendre(livre);

  onEtape?.({ nom: "enregistrement" });
  // Clé neuve à chaque export : rien n'est jamais écrasé, l'ancien fichier sert jusqu'au bout.
  const cle = dependances.nouvelleCle();
  await dependances.deposerPdf(cle, pdf);
  try {
    await dependances.enregistrerExport(cle);
  } catch (erreur) {
    await dependances.supprimerPdf(cle).catch(() => undefined);
    throw erreur;
  }

  if (ancienne) {
    // Un échec laisse un fichier orphelin, ce que l'architecture accepte.
    await dependances.supprimerPdf(ancienne).catch(() => undefined);
  }
  return cle;
}
