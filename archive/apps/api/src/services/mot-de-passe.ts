import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// argon2 est natif depuis Node 24.7 : aucune dépendance à compiler ni à surveiller.
const deriver = promisify(argon2);

// Paramètres minimaux recommandés par l'OWASP pour argon2id (19 Mio, 2 passes, 1 fil).
const MEMOIRE_KIO = 19456;
const PASSES = 2;
const PARALLELISME = 1;
const LONGUEUR_SEL = 16;
const LONGUEUR_EMPREINTE = 32;

async function calculer(
  motDePasse: string,
  sel: Buffer,
  memoire: number,
  passes: number,
  parallelisme: number,
  longueur: number,
): Promise<Buffer> {
  return deriver("argon2id", {
    message: motDePasse,
    nonce: sel,
    memory: memoire,
    passes,
    parallelism: parallelisme,
    tagLength: longueur,
  });
}

// Format PHC, le même que les bibliothèques argon2 : les paramètres voyagent avec
// l'empreinte, on peut donc les durcir plus tard sans invalider les comptes existants.
export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  const sel = randomBytes(LONGUEUR_SEL);
  const empreinte = await calculer(
    motDePasse,
    sel,
    MEMOIRE_KIO,
    PASSES,
    PARALLELISME,
    LONGUEUR_EMPREINTE,
  );
  return `$argon2id$v=19$m=${MEMOIRE_KIO},t=${PASSES},p=${PARALLELISME}$${sel.toString("base64url")}$${empreinte.toString("base64url")}`;
}

const FORMAT_PHC =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([\w-]+)\$([\w-]+)$/;

export async function verifierMotDePasse(
  motDePasse: string,
  hache: string,
): Promise<boolean> {
  const [, memoire, passes, parallelisme, sel, attendu] =
    FORMAT_PHC.exec(hache) ?? [];
  if (!memoire || !passes || !parallelisme || !sel || !attendu) {
    return false;
  }
  const empreinteAttendue = Buffer.from(attendu, "base64url");
  const empreinte = await calculer(
    motDePasse,
    Buffer.from(sel, "base64url"),
    Number(memoire),
    Number(passes),
    Number(parallelisme),
    empreinteAttendue.length,
  );
  return timingSafeEqual(empreinte, empreinteAttendue);
}

// Vérifié quand l'email est inconnu : sans lui, la réponse rapide trahirait
// quels emails ont un compte.
export const HACHE_FACTICE = await hacherMotDePasse(
  randomBytes(32).toString("hex"),
);
