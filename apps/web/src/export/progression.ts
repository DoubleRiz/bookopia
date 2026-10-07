import type { Etape } from "./exporter";

// Part de la barre occupée par le téléchargement des photos : c'est la phase longue.
// La composition et l'enregistrement se partagent le reste, sans mesure plus fine.
const PART_TELECHARGEMENT = 75;
const PART_COMPOSITION = 85;
const PART_ENREGISTREMENT = 95;

// Avancement de l'export en pourcentage, de 0 (préparation) à 95 : la barre n'atteint 100
// que lorsque l'écran quitte l'état « en cours ».
export function progressionExport(etape: Etape | null): number {
  if (!etape) return 0;
  if (etape.nom === "telechargement") {
    return etape.total === 0
      ? 0
      : Math.round((etape.faits / etape.total) * PART_TELECHARGEMENT);
  }
  return etape.nom === "composition" ? PART_COMPOSITION : PART_ENREGISTREMENT;
}
