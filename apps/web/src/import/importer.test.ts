import { describe, expect, it } from "vitest";
import { ErreurNonAuthentifie } from "../api/client";
import {
  type Avancement,
  type DependancesImport,
  ErreurDoublon,
  importer,
  type PhotoPreparee,
  type Source,
  sourceLocale,
} from "./importer";
import { ErreurGoogleNonAutorise } from "./google/selecteur";

const fichier = (nom: string): Source =>
  sourceLocale(new File([nom], nom, { type: "image/jpeg" }));

const preparee = (largeurPx = 4000, hauteurPx = 3000): PhotoPreparee => ({
  largeurPx,
  hauteurPx,
  priseLe: null,
  original: new Blob(),
  vignette: new Blob(),
  formatVignette: "webp",
});

// L'empreinte d'un faux fichier est son contenu : deux fichiers de même contenu sont des doublons.
function dependances(
  surcharge: Partial<DependancesImport> = {},
): DependancesImport & { envoyes: string[] } {
  const envoyes: string[] = [];
  return {
    envoyes,
    lireEmpreintes: async () => new Set<string>(),
    calculerEmpreinte: async (f) => f.text(),
    preparer: async () => preparee(),
    envoyer: async (photo) => {
      envoyes.push(photo.nomFichier);
    },
    ...surcharge,
  };
}

describe("importer", () => {
  it("envoie chaque fichier et fait le bilan", async () => {
    const dep = dependances();
    const bilan = await importer([fichier("a"), fichier("b")], dep);
    expect(dep.envoyes.sort()).toEqual(["a", "b"]);
    expect(bilan).toEqual({
      total: 2,
      traites: 2,
      importees: 2,
      doublons: 0,
      echecs: [],
      avertissements: [],
    });
  });

  it("écarte, sans les préparer, les photos déjà dans le livre", async () => {
    const preparees: string[] = [];
    const dep = dependances({
      lireEmpreintes: async () => new Set(["a"]),
      preparer: async (f) => {
        preparees.push(f.name);
        return preparee();
      },
    });
    const bilan = await importer([fichier("a"), fichier("b")], dep);
    expect(preparees).toEqual(["b"]);
    expect(bilan.importees).toBe(1);
    expect(bilan.doublons).toBe(1);
  });

  it("écarte un doublon à l'intérieur de la sélection", async () => {
    const dep = dependances();
    const memeContenu = sourceLocale(
      new File(["a"], "copie.jpg", { type: "image/jpeg" }),
    );
    const bilan = await importer([fichier("a"), memeContenu], dep);
    expect(dep.envoyes).toHaveLength(1);
    expect(bilan.doublons).toBe(1);
  });

  it("compte comme doublon un refus d'unicité au moment de l'insertion", async () => {
    const dep = dependances({
      envoyer: async () => {
        throw new ErreurDoublon();
      },
    });
    const bilan = await importer([fichier("a")], dep);
    expect(bilan.importees).toBe(0);
    expect(bilan.doublons).toBe(1);
  });

  it("isole l'échec d'un fichier sans arrêter les autres (RG-05)", async () => {
    const dep = dependances({
      preparer: async (f) => {
        if (f.name === "abime") throw new Error("décodage impossible");
        return preparee();
      },
      envoyer: async (photo) => {
        if (photo.nomFichier === "coupe") throw new Error("réseau");
        dep.envoyes.push(photo.nomFichier);
      },
    });
    const bilan = await importer(
      [fichier("abime"), fichier("coupe"), fichier("ok")],
      dep,
    );
    expect(dep.envoyes).toEqual(["ok"]);
    expect(bilan.importees).toBe(1);
    expect(bilan.echecs).toEqual([
      { nom: "abime", raison: "illisible" },
      { nom: "coupe", raison: "envoi" },
    ]);
  });

  it("compte comme illisible un fichier qu'on ne peut plus lire", async () => {
    const dep = dependances({
      calculerEmpreinte: async () => {
        throw new Error("NotReadableError");
      },
    });
    const bilan = await importer([fichier("parti")], dep);
    expect(bilan.echecs).toEqual([{ nom: "parti", raison: "illisible" }]);
  });

  it("avertit sous 1000 px de côté long, sans refuser", async () => {
    const dep = dependances({ preparer: async () => preparee(999, 600) });
    const bilan = await importer([fichier("petite")], dep);
    expect(bilan.importees).toBe(1);
    expect(bilan.avertissements).toEqual(["petite"]);
  });

  it("traite trois fichiers au plus en même temps", async () => {
    let enCours = 0;
    let maximum = 0;
    const dep = dependances({
      preparer: async () => {
        enCours += 1;
        maximum = Math.max(maximum, enCours);
        await new Promise((fin) => setTimeout(fin, 5));
        enCours -= 1;
        return preparee();
      },
    });
    const fichiers = Array.from({ length: 10 }, (_, i) => fichier(`f${i}`));
    const bilan = await importer(fichiers, dep);
    expect(bilan.importees).toBe(10);
    expect(maximum).toBe(3);
  });

  it("publie l'avancement après chaque fichier", async () => {
    const etapes: number[] = [];
    await importer([fichier("a"), fichier("b")], dependances(), {
      onAvancement: (avancement: Avancement) => etapes.push(avancement.traites),
    });
    expect(etapes).toEqual([1, 2]);
  });

  it("s'arrête et remonte l'erreur quand la session a expiré", async () => {
    const dep = dependances({
      envoyer: async () => {
        throw new ErreurNonAuthentifie();
      },
    });
    const fichiers = Array.from({ length: 10 }, (_, i) => fichier(`f${i}`));
    await expect(importer(fichiers, dep)).rejects.toBeInstanceOf(
      ErreurNonAuthentifie,
    );
  });

  it("compte comme échec de téléchargement une source qu'on n'obtient pas", async () => {
    const dep = dependances();
    const bilan = await importer(
      [
        {
          nom: "google.jpg",
          obtenir: async () => {
            throw new Error("réseau");
          },
        },
        fichier("ok"),
      ],
      dep,
    );
    expect(dep.envoyes).toEqual(["ok"]);
    expect(bilan.echecs).toEqual([
      { nom: "google.jpg", raison: "telechargement" },
    ]);
  });

  it("refuse après obtention un fichier de mauvais format ou trop lourd", async () => {
    const dep = dependances();
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const lourd = new File(["x"], "lourd.jpg", { type: "image/jpeg" });
    Object.defineProperty(lourd, "size", { value: 11 * 1024 * 1024 });
    const bilan = await importer(
      [sourceLocale(pdf), sourceLocale(lourd), fichier("ok")],
      dep,
    );
    expect(dep.envoyes).toEqual(["ok"]);
    expect(bilan.echecs).toEqual([
      { nom: "doc.pdf", raison: "format" },
      { nom: "lourd.jpg", raison: "taille" },
    ]);
  });

  it("s'arrête quand Google refuse le jeton en cours d'import", async () => {
    const sources: Source[] = Array.from({ length: 10 }, (_, i) => ({
      nom: `g${i}`,
      obtenir: async () => {
        throw new ErreurGoogleNonAutorise();
      },
    }));
    await expect(importer(sources, dependances())).rejects.toBeInstanceOf(
      ErreurGoogleNonAutorise,
    );
  });
});
