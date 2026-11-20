import { describe, expect, it } from "vitest";
import * as index from "./index";

// L'index est tiré par tous les écrans, l'accueil compris. pdf-lib et fontkit pèsent plus d'un
// mégaoctet : ils vivent derrière leurs propres points d'entrée, chargés à l'ouverture de
// l'éditeur et de l'export (BK-133).
describe("index de shared", () => {
  it("n'exporte pas de code qui embarque pdf-lib ou fontkit", () => {
    expect(index).not.toHaveProperty("rendre");
    expect(index).not.toHaveProperty("creerMesure");
  });
});
