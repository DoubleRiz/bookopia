const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// N'accepter que des UUID garantit qu'un chemin construit ne contient ni « .. » ni « / ».
function exigerUuid(valeur: string, nom: string) {
  if (!UUID.test(valeur)) {
    throw new Error(`${nom} n'est pas un UUID : ${valeur}`);
  }
}

function cheminDuProjet(
  projetId: string,
  cle: string,
  dossier: string,
  extension: string,
) {
  exigerUuid(projetId, "projetId");
  exigerUuid(cle, "cle");
  return `projets/${projetId}/${dossier}/${cle}${extension}`;
}

// JPEG : pdf-lib n'intègre que JPEG et PNG, et l'original est ré-encodé de toute façon au redimensionnement.
export function cheminOriginal(projetId: string, cle: string) {
  return cheminDuProjet(projetId, cle, "originaux", ".jpg");
}

// WebP : lue seulement par le navigateur, plus légère qu'un JPEG sur une grille de vignettes.
export function cheminVignette(projetId: string, cle: string) {
  return cheminDuProjet(projetId, cle, "vignettes", ".webp");
}

export function cheminExport(projetId: string, cle: string) {
  return cheminDuProjet(projetId, cle, "exports", ".pdf");
}
