import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErreurBase } from "../api/client";
import { creerPhoto, deposerFichier, supprimerFichiers } from "../api/photos";
import { envoyeur } from "./envoyer";
import { ErreurDoublon, ErreurPlafond, type PhotoAEnvoyer } from "./importer";

// Le vrai module ouvre un client Supabase : remplacé entièrement.
vi.mock("../api/photos", () => ({
  cheminOriginal: (u: string, p: string, c: string) =>
    `${u}/${p}/originaux/${c}.jpg`,
  cheminVignette: (u: string, p: string, c: string) =>
    `${u}/${p}/vignettes/${c}`,
  deposerFichier: vi.fn(),
  creerPhoto: vi.fn(),
  supprimerFichiers: vi.fn(),
}));

const photo: PhotoAEnvoyer = {
  largeurPx: 4000,
  hauteurPx: 3000,
  priseLe: null,
  original: new Blob(),
  vignette: new Blob(),
  formatVignette: "webp",
  nomFichier: "a.jpg",
  empreinte: "a".repeat(64),
};

const envoyer = envoyeur("utilisateur", "livre");

describe("envoyer", () => {
  beforeEach(() => {
    vi.mocked(deposerFichier).mockReset().mockResolvedValue(undefined);
    vi.mocked(creerPhoto).mockReset();
    vi.mocked(supprimerFichiers).mockReset().mockResolvedValue(undefined);
  });

  it("traduit le refus du plafond et supprime les fichiers déposés", async () => {
    vi.mocked(creerPhoto).mockRejectedValue(
      new ErreurBase("plafond", "Un livre compte au plus 100 photos"),
    );
    await expect(envoyer(photo)).rejects.toBeInstanceOf(ErreurPlafond);
    expect(supprimerFichiers).toHaveBeenCalledOnce();
    expect(vi.mocked(supprimerFichiers).mock.calls[0]?.[0]).toHaveLength(2);
  });

  it("traduit la violation d'unicité en doublon", async () => {
    vi.mocked(creerPhoto).mockRejectedValue(new ErreurBase("23505", null));
    await expect(envoyer(photo)).rejects.toBeInstanceOf(ErreurDoublon);
  });
});
