import { deflateSync } from "node:zlib";

// PNG uni fabriqué à la volée : pas de fichier binaire dans le dépôt, et une couleur par photo
// pour que deux photos n'aient pas la même empreinte.
export function png(
  largeur: number,
  hauteur: number,
  [r, v, b]: number[],
): Buffer {
  const morceau = (type: string, donnees: Buffer) => {
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
    const controle = Buffer.alloc(4);
    controle.writeUInt32BE(crc32(corps));
    return Buffer.concat([longueur, corps, controle]);
  };
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete.writeUInt8(8, 8); // 8 bits par canal
  entete.writeUInt8(2, 9); // RVB
  const ligne = Buffer.alloc(1 + largeur * 3);
  for (let x = 0; x < largeur; x += 1) {
    ligne.set([r ?? 0, v ?? 0, b ?? 0], 1 + x * 3);
  }
  const pixels = Buffer.concat(Array.from({ length: hauteur }, () => ligne));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau("IHDR", entete),
    morceau("IDAT", deflateSync(pixels)),
    morceau("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(octets: Buffer): number {
  let crc = 0xffffffff;
  for (const octet of octets) {
    crc ^= octet;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
