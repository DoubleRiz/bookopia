import { describe, expect, it } from "vitest";
import {
  cadrageSchema,
  connexionSchema,
  creerProjetSchema,
  deplacerDoublePageSchema,
  insererDoublePageSchema,
  inscriptionSchema,
  poserPhotoSchema,
  renommerProjetSchema,
} from "./entrees";

// Identifiant du catalogue de départ : bien formé pour PostgreSQL, hors variante RFC.
const ID_CATALOGUE = "00000000-0000-4000-d000-000000000001";
const ID_PHOTO = "00000000-0000-4000-b000-000000000003";

const accepte =
  (schema: { safeParse: (v: unknown) => { success: boolean } }) =>
  (valeur: unknown) =>
    schema.safeParse(valeur).success;

describe("creerProjetSchema", () => {
  it("accepte un titre, un modèle du catalogue et les gabarits choisis", () => {
    expect(
      creerProjetSchema.parse({
        titre: "  Vacances  ",
        modeleLivreId: ID_CATALOGUE,
        gabaritsInterieursIds: [ID_PHOTO],
      }),
    ).toEqual({
      titre: "Vacances",
      modeleLivreId: ID_CATALOGUE,
      gabaritsInterieursIds: [ID_PHOTO],
    });
  });

  it("refuse un titre fait d'espaces et un identifiant mal formé", () => {
    const valide = accepte(creerProjetSchema);
    expect(
      valide({
        titre: "   ",
        modeleLivreId: ID_CATALOGUE,
        gabaritsInterieursIds: [],
      }),
    ).toBe(false);
    expect(
      valide({
        titre: "Livre",
        modeleLivreId: "abc",
        gabaritsInterieursIds: [],
      }),
    ).toBe(false);
  });
});

describe("renommerProjetSchema", () => {
  it("accepte un titre long et refuse un titre vide", () => {
    const valide = accepte(renommerProjetSchema);
    expect(valide({ titre: "x".repeat(500) })).toBe(true);
    expect(valide({ titre: "" })).toBe(false);
  });
});

describe("positions de double page", () => {
  it("commencent à 1 et sont entières", () => {
    const inserer = accepte(insererDoublePageSchema);
    expect(inserer({ gabaritId: ID_CATALOGUE, position: 1 })).toBe(true);
    expect(inserer({ gabaritId: ID_CATALOGUE, position: 0 })).toBe(false);
    expect(inserer({ gabaritId: ID_CATALOGUE, position: 1.5 })).toBe(false);

    const deplacer = accepte(deplacerDoublePageSchema);
    expect(deplacer({ position: 3 })).toBe(true);
    expect(deplacer({ position: -1 })).toBe(false);
  });
});

describe("cadrageSchema et poserPhotoSchema", () => {
  it("bornent le centre entre 0 et 1 et le zoom à 1 au moins", () => {
    const valide = accepte(cadrageSchema);
    expect(valide({ x: 0, y: 1, zoom: 1 })).toBe(true);
    expect(valide({ x: 1.1, y: 0.5, zoom: 1 })).toBe(false);
    expect(valide({ x: 0.5, y: -0.1, zoom: 1 })).toBe(false);
    expect(valide({ x: 0.5, y: 0.5, zoom: 0.9 })).toBe(false);
  });

  it("exige une photo et un cadrage valide", () => {
    const valide = accepte(poserPhotoSchema);
    expect(
      valide({ photoId: ID_PHOTO, cadrage: { x: 0.5, y: 0.5, zoom: 2 } }),
    ).toBe(true);
    expect(
      valide({ photoId: ID_PHOTO, cadrage: { x: 0.5, y: 0.5, zoom: 0 } }),
    ).toBe(false);
  });
});

describe("inscriptionSchema", () => {
  const inscription = {
    email: "  Alice@Exemple.FR ",
    motDePasse: "12345678",
    nomAffichage: " Alice ",
  };

  it("normalise l'email en minuscules et retire les espaces", () => {
    expect(inscriptionSchema.parse(inscription)).toEqual({
      email: "alice@exemple.fr",
      motDePasse: "12345678",
      nomAffichage: "Alice",
    });
  });

  it("refuse un email invalide, un mot de passe trop court ou trop long, un nom vide ou trop long", () => {
    const valide = accepte(inscriptionSchema);
    expect(valide({ ...inscription, email: "alice" })).toBe(false);
    expect(valide({ ...inscription, motDePasse: "1234567" })).toBe(false);
    expect(valide({ ...inscription, motDePasse: "x".repeat(129) })).toBe(false);
    expect(valide({ ...inscription, nomAffichage: "  " })).toBe(false);
    expect(valide({ ...inscription, nomAffichage: "x".repeat(81) })).toBe(
      false,
    );
  });
});

describe("connexionSchema", () => {
  it("n'applique pas la longueur minimale de l'inscription", () => {
    expect(
      connexionSchema.parse({ email: "BOB@exemple.fr", motDePasse: "a" }),
    ).toEqual({ email: "bob@exemple.fr", motDePasse: "a" });
  });

  it("refuse un mot de passe vide", () => {
    expect(
      accepte(connexionSchema)({ email: "bob@exemple.fr", motDePasse: "" }),
    ).toBe(false);
  });
});
