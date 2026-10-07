import { readFileSync } from "node:fs";
import {
  creerMesure,
  FICHIERS_POLICES,
  type ClePolice,
  type MesureTexte,
} from "./polices";

// Les vrais fichiers du dépôt, pour les tests : ce que l'écran et le PDF utilisent.
export function octetsDePolice(cle: ClePolice): Uint8Array {
  return readFileSync(
    new URL(`../polices/${FICHIERS_POLICES[cle]}`, import.meta.url),
  );
}

const cache = new Map<ClePolice, MesureTexte>();

export function mesuresReelles(cle: ClePolice): MesureTexte {
  let mesure = cache.get(cle);
  if (!mesure) {
    mesure = creerMesure(octetsDePolice(cle));
    cache.set(cle, mesure);
  }
  return mesure;
}
