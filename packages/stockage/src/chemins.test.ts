import { describe, expect, it } from "vitest";
import { cheminExport, cheminOriginal, cheminVignette } from "./chemins";

const PROJET = "01926b3e-7c1a-7000-8000-000000000001";
const CLE = "01926b3e-7c1a-7000-8000-0000000000aa";

describe("chemins", () => {
  it("range l'original, la vignette et l'export sous le dossier du projet", () => {
    expect(cheminOriginal(PROJET, CLE)).toBe(
      `projets/${PROJET}/originaux/${CLE}.jpg`,
    );
    expect(cheminVignette(PROJET, CLE)).toBe(
      `projets/${PROJET}/vignettes/${CLE}.webp`,
    );
    expect(cheminExport(PROJET, CLE)).toBe(
      `projets/${PROJET}/exports/${CLE}.pdf`,
    );
  });

  it.each([
    ["..", CLE],
    [PROJET, "../../etc/passwd"],
    [PROJET, `${CLE}/x`],
    ["", CLE],
    [PROJET, "pas-un-uuid"],
  ])(
    "refuse un identifiant qui n'est pas un UUID (%s, %s)",
    (projetId, cle) => {
      expect(() => cheminOriginal(projetId, cle)).toThrow();
      expect(() => cheminVignette(projetId, cle)).toThrow();
      expect(() => cheminExport(projetId, cle)).toThrow();
    },
  );
});
