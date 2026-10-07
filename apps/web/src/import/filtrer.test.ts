import { describe, expect, it } from "vitest";
import { filtrer, TAILLE_MAX_OCTETS } from "./filtrer";

const fichier = (nom: string, type: string, octets = 1000) =>
  new File([new Uint8Array(octets)], nom, { type });

describe("filtrer", () => {
  it("accepte le JPEG, le PNG et le WebP", () => {
    const fichiers = [
      fichier("a.jpg", "image/jpeg"),
      fichier("b.png", "image/png"),
      fichier("c.webp", "image/webp"),
    ];
    expect(filtrer(fichiers)).toEqual({ acceptes: fichiers, refuses: [] });
  });

  it("refuse le SVG, le HEIC et un type inconnu (RG-02)", () => {
    const { acceptes, refuses } = filtrer([
      fichier("a.svg", "image/svg+xml"),
      fichier("b.heic", "image/heic"),
      fichier("c", ""),
    ]);
    expect(acceptes).toEqual([]);
    expect(refuses).toEqual([
      { nom: "a.svg", raison: "format" },
      { nom: "b.heic", raison: "format" },
      { nom: "c", raison: "format" },
    ]);
  });

  it("refuse au-delà de 10 Mo, et accepte 10 Mo tout juste (RG-01)", () => {
    const limite = fichier("limite.jpg", "image/jpeg", TAILLE_MAX_OCTETS);
    const { acceptes, refuses } = filtrer([
      limite,
      fichier("lourd.jpg", "image/jpeg", TAILLE_MAX_OCTETS + 1),
    ]);
    expect(acceptes).toEqual([limite]);
    expect(refuses).toEqual([{ nom: "lourd.jpg", raison: "taille" }]);
  });
});
