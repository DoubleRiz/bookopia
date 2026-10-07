import { ErreurNonAuthentifie } from "../api/client";

// Sortie de la préparation dans le navigateur : ce qui est déposé, et ce que la ligne photo retient.
export type PhotoPreparee = {
  largeurPx: number;
  hauteurPx: number;
  priseLe: Date | null;
  original: Blob;
  vignette: Blob;
  formatVignette: "webp" | "jpeg";
};

export type PhotoAEnvoyer = PhotoPreparee & {
  nomFichier: string;
  empreinte: string;
};

// L'unicité (projet_id, empreinte_fichier) a refusé la ligne : la même photo est arrivée
// entre-temps, par un autre onglet. Ce n'est pas un échec.
export class ErreurDoublon extends Error {
  constructor() {
    super("Photo déjà dans le livre");
    this.name = "ErreurDoublon";
  }
}

export type DependancesImport = {
  lireEmpreintes: () => Promise<Set<string>>;
  calculerEmpreinte: (fichier: File) => Promise<string>;
  preparer: (fichier: File) => Promise<PhotoPreparee>;
  envoyer: (photo: PhotoAEnvoyer) => Promise<void>;
};

export type Echec = { nom: string; raison: "illisible" | "envoi" };

export type Avancement = {
  total: number;
  traites: number;
  importees: number;
  doublons: number;
  echecs: Echec[];
  // Noms des photos importées sous 1000 px de côté long : imprimables, mais floues en grand.
  avertissements: string[];
};

// Assez pour occuper le réseau pendant qu'une autre photo se prépare ; peu, pour la mémoire :
// une photo de 24 Mpx décodée pèse près de 100 Mo.
const FICHIERS_EN_PARALLELE = 3;
const COTE_LONG_CONSEILLE_PX = 1000;

// Une erreur porte sur un fichier, jamais sur la file. Seule une session expirée arrête tout :
// les fichiers suivants seraient refusés de la même façon.
export async function importer(
  fichiers: File[],
  dependances: DependancesImport,
  { onAvancement }: { onAvancement?: (avancement: Avancement) => void } = {},
): Promise<Avancement> {
  const avancement: Avancement = {
    total: fichiers.length,
    traites: 0,
    importees: 0,
    doublons: 0,
    echecs: [],
    avertissements: [],
  };
  // Lues une fois : la reprise d'un import interrompu saute ainsi ce qui est déjà arrivé.
  // Chaque empreinte y entre avant la préparation, ce qui écarte aussi les doublons de la sélection.
  const empreintes = await dependances.lireEmpreintes();
  const file = [...fichiers];
  let arrete = false;

  async function traiter(fichier: File) {
    let empreinte: string;
    try {
      empreinte = await dependances.calculerEmpreinte(fichier);
    } catch {
      // Fichier déplacé ou supprimé depuis la sélection : le navigateur ne peut plus le lire.
      avancement.echecs.push({ nom: fichier.name, raison: "illisible" });
      return;
    }
    if (empreintes.has(empreinte)) {
      avancement.doublons += 1;
      return;
    }
    empreintes.add(empreinte);

    let photo: PhotoPreparee;
    try {
      photo = await dependances.preparer(fichier);
    } catch {
      avancement.echecs.push({ nom: fichier.name, raison: "illisible" });
      return;
    }

    try {
      await dependances.envoyer({
        ...photo,
        nomFichier: fichier.name,
        empreinte,
      });
    } catch (erreur) {
      if (erreur instanceof ErreurDoublon) {
        avancement.doublons += 1;
        return;
      }
      if (erreur instanceof ErreurNonAuthentifie) {
        throw erreur;
      }
      avancement.echecs.push({ nom: fichier.name, raison: "envoi" });
      return;
    }

    avancement.importees += 1;
    if (Math.max(photo.largeurPx, photo.hauteurPx) < COTE_LONG_CONSEILLE_PX) {
      avancement.avertissements.push(fichier.name);
    }
  }

  async function ouvrier() {
    for (
      let fichier = file.shift();
      fichier && !arrete;
      fichier = file.shift()
    ) {
      try {
        await traiter(fichier);
      } catch (erreur) {
        arrete = true;
        throw erreur;
      }
      avancement.traites += 1;
      onAvancement?.({ ...avancement, echecs: [...avancement.echecs] });
    }
  }

  await Promise.all(
    Array.from({ length: FICHIERS_EN_PARALLELE }, () => ouvrier()),
  );
  return avancement;
}
