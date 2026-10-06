import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { creerStockageDisque } from "@bookopia/stockage";

export const SECRET_DE_TEST = "secret-de-test-de-trente-deux-octets-au-moins";

// Un dossier temporaire par appel : les tests n'écrivent jamais dans le volume de développement.
export async function creerStockageDeTest() {
  const racine = await mkdtemp(join(tmpdir(), "bookopia-api-"));
  return {
    racine,
    secret: SECRET_DE_TEST,
    stockage: creerStockageDisque({ racine, secret: SECRET_DE_TEST }),
  };
}
