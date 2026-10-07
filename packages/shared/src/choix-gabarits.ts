import type { Tables } from "./base";

type GabaritCandidat = Pick<
  Tables<"gabarit">,
  "id" | "nom" | "role" | "famille" | "actif"
>;
type ModeleACopier = Pick<
  Tables<"modele_livre">,
  "famille" | "nombre_doubles_pages_depart"
>;

// Règle provisoire du moteur de gabarits : les intérieurs de la famille du modèle, à tour de rôle.
// Tri par nom pour que deux créations depuis le même modèle donnent le même livre.
// Liste vide si rien ne convient : creer_projet refusera, c'est la base qui tranche.
export function choisirGabaritsInterieurs(
  gabarits: GabaritCandidat[],
  modele: ModeleACopier,
): string[] {
  const candidats = gabarits
    .filter(
      (gabarit) =>
        gabarit.actif &&
        gabarit.role === "interieur" &&
        gabarit.famille === modele.famille,
    )
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    .map((gabarit) => gabarit.id);

  if (candidats.length === 0) {
    return [];
  }
  const nombre = modele.nombre_doubles_pages_depart;
  const tours = Math.ceil(nombre / candidats.length);
  return Array.from({ length: tours }, () => candidats)
    .flat()
    .slice(0, nombre);
}
