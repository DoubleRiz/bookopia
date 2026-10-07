import { describe, expect, it } from "vitest";
import { hacherMotDePasse, verifierMotDePasse } from "./mot-de-passe";

describe("hachage du mot de passe", () => {
  it("vérifie le bon mot de passe et rejette les autres", async () => {
    const hache = await hacherMotDePasse("correct-horse-battery");

    expect(await verifierMotDePasse("correct-horse-battery", hache)).toBe(true);
    expect(await verifierMotDePasse("correct-horse-batterY", hache)).toBe(
      false,
    );
  });

  it("sale chaque empreinte : deux hachages du même mot de passe diffèrent", async () => {
    const premier = await hacherMotDePasse("identique");
    const second = await hacherMotDePasse("identique");

    expect(premier).not.toBe(second);
  });

  it("rejette une empreinte mal formée sans lever d'erreur", async () => {
    expect(await verifierMotDePasse("x", "sans-objet")).toBe(false);
  });
});
