import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { Readable } from "node:stream";
import { signer, verifierSignature } from "./signature";

// Le chemin relatif que le front demande : identique derrière le proxy Vite et derrière Caddy, qui retirent « /api ».
export const PREFIXE_URL_FICHIERS = "/api/fichiers";

const TAILLE_MIN_SECRET_OCTETS = 32;

// L'interface documentée dans architecture.md, plus `flux` : un PDF de plusieurs dizaines de Mo ne se charge pas en mémoire.
export interface StockageFichiers {
  ranger(chemin: string, contenu: Buffer): Promise<void>;
  lire(chemin: string): Promise<Buffer>;
  flux(chemin: string): Promise<Readable>;
  supprimer(chemin: string): Promise<void>;
  urlSignee(chemin: string, dureeSecondes: number): Promise<string>;
}

// Propre au disque : sans fournisseur pour servir l'URL signée, c'est l'API qui la vérifie.
// Avec un stockage objet, cette méthode et la route qui l'appelle disparaîtraient.
export interface StockageDisque extends StockageFichiers {
  verifier(chemin: string, expire: number, signature: string): boolean;
}

export class FichierIntrouvable extends Error {
  constructor(readonly chemin: string) {
    super(`Fichier introuvable : ${chemin}`);
    this.name = "FichierIntrouvable";
  }
}

export class CheminHorsRacine extends Error {
  constructor(readonly chemin: string) {
    super(`Chemin hors de la racine de stockage : ${chemin}`);
    this.name = "CheminHorsRacine";
  }
}

function estAbsent(erreur: unknown) {
  return (
    erreur instanceof Error && "code" in erreur && erreur.code === "ENOENT"
  );
}

export function creerStockageDisque({
  racine,
  secret,
}: {
  racine: string;
  secret: string;
}): StockageDisque {
  if (Buffer.byteLength(secret) < TAILLE_MIN_SECRET_OCTETS) {
    throw new Error(
      `Le secret de signature doit faire au moins ${TAILLE_MIN_SECRET_OCTETS} octets`,
    );
  }
  const racineAbsolue = resolve(racine);

  // Vérifié à chaque appel : la route transmet un chemin venu de l'extérieur.
  function absolu(chemin: string) {
    const resultat = resolve(racineAbsolue, chemin);
    if (!resultat.startsWith(racineAbsolue + sep)) {
      throw new CheminHorsRacine(chemin);
    }
    return resultat;
  }

  return {
    // Écrire à côté puis renommer : un fichier à moitié écrit n'est jamais lisible,
    // et le remplacement d'un export ne laisse aucune fenêtre de lecture corrompue.
    async ranger(chemin, contenu) {
      const cible = absolu(chemin);
      const temporaire = `${cible}.${randomUUID()}.tmp`;
      await mkdir(dirname(cible), { recursive: true });
      try {
        await writeFile(temporaire, contenu);
        await rename(temporaire, cible);
      } catch (erreur) {
        await rm(temporaire, { force: true });
        throw erreur;
      }
    },

    async lire(chemin) {
      const cible = absolu(chemin);
      try {
        return await readFile(cible);
      } catch (erreur) {
        if (estAbsent(erreur)) throw new FichierIntrouvable(chemin);
        throw erreur;
      }
    },

    // Ouvrir avant de renvoyer le flux : l'absence se signale ici, avant que la réponse ne parte.
    async flux(chemin) {
      const cible = absolu(chemin);
      try {
        const fichier = await open(cible);
        return fichier.createReadStream();
      } catch (erreur) {
        if (estAbsent(erreur)) throw new FichierIntrouvable(chemin);
        throw erreur;
      }
    },

    // Idempotent : la purge et le remplacement d'un export n'ont pas à vérifier l'existence.
    async supprimer(chemin) {
      await rm(absolu(chemin), { force: true });
    },

    async urlSignee(chemin, dureeSecondes) {
      absolu(chemin);
      if (!Number.isInteger(dureeSecondes) || dureeSecondes <= 0) {
        throw new Error(`Durée de validité invalide : ${dureeSecondes}`);
      }
      const expire = Math.floor(Date.now() / 1000) + dureeSecondes;
      const signature = signer(secret, chemin, expire);
      return `${PREFIXE_URL_FICHIERS}/${chemin}?expire=${expire}&signature=${signature}`;
    },

    verifier(chemin, expire, signature) {
      return verifierSignature(secret, chemin, expire, signature);
    },
  };
}
