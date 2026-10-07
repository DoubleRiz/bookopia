import { describe, expect, it } from "vitest";
import { signer, verifierSignature } from "./signature";

const SECRET = "secret-de-test-de-trente-deux-octets-au-moins";
const CHEMIN = "projets/p/originaux/c.jpg";
const MAINTENANT = 1_800_000_000;

describe("signature", () => {
  it("produit une signature base64url stable", () => {
    const signature = signer(SECRET, CHEMIN, MAINTENANT + 60);
    expect(signature).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(signer(SECRET, CHEMIN, MAINTENANT + 60)).toBe(signature);
  });

  it("accepte une signature valide avant l'expiration", () => {
    const expire = MAINTENANT + 60;
    expect(
      verifierSignature(
        SECRET,
        CHEMIN,
        expire,
        signer(SECRET, CHEMIN, expire),
        MAINTENANT,
      ),
    ).toBe(true);
  });

  it("refuse une URL expirée, y compris à la seconde exacte", () => {
    const expire = MAINTENANT;
    const signature = signer(SECRET, CHEMIN, expire);
    expect(
      verifierSignature(SECRET, CHEMIN, expire, signature, MAINTENANT),
    ).toBe(false);
    expect(
      verifierSignature(SECRET, CHEMIN, expire, signature, MAINTENANT + 1),
    ).toBe(false);
  });

  it("refuse une signature calculée pour un autre chemin, une autre expiration ou un autre secret", () => {
    const expire = MAINTENANT + 60;
    const signature = signer(SECRET, CHEMIN, expire);
    expect(
      verifierSignature(
        SECRET,
        "projets/p/exports/c.pdf",
        expire,
        signature,
        MAINTENANT,
      ),
    ).toBe(false);
    expect(
      verifierSignature(SECRET, CHEMIN, expire + 1, signature, MAINTENANT),
    ).toBe(false);
    expect(
      verifierSignature(`${SECRET}x`, CHEMIN, expire, signature, MAINTENANT),
    ).toBe(false);
  });

  it("refuse sans lever une signature vide, tronquée ou altérée", () => {
    const expire = MAINTENANT + 60;
    const signature = signer(SECRET, CHEMIN, expire);
    const alteree = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    for (const candidate of [
      "",
      signature.slice(1),
      `${signature}A`,
      alteree,
    ]) {
      expect(
        verifierSignature(SECRET, CHEMIN, expire, candidate, MAINTENANT),
      ).toBe(false);
    }
  });
});
