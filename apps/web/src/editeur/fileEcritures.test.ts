import { describe, expect, it } from "vitest";
import { creerFileEcritures, type StatutEnregistrement } from "./fileEcritures";

// Une écriture qu'on termine à la main, pour observer la file entre deux étapes.
function differee() {
  let reussir!: () => void;
  let echouer!: (erreur: unknown) => void;
  const promesse = new Promise<void>((resolve, reject) => {
    reussir = resolve;
    echouer = reject;
  });
  return { promesse, reussir, echouer };
}

function fileObservee() {
  const statuts: StatutEnregistrement[] = [];
  const erreurs: unknown[] = [];
  const file = creerFileEcritures({
    surStatut: (statut) => statuts.push(statut),
    surEchec: (erreur) => erreurs.push(erreur),
  });
  return { file, statuts, erreurs };
}

describe("creerFileEcritures", () => {
  it("applique le geste tout de suite, puis enregistre", async () => {
    const { file, statuts } = fileObservee();
    const journal: string[] = [];
    const ecriture = differee();
    file.ajouter({
      appliquer: () => journal.push("appliqué"),
      ecrire: () => ecriture.promesse,
      retablir: () => journal.push("rétabli"),
    });
    expect(journal).toEqual(["appliqué"]);
    expect(statuts.at(-1)).toBe("enregistrement");
    ecriture.reussir();
    await file.terminer();
    expect(statuts.at(-1)).toBe("enregistre");
    expect(journal).toEqual(["appliqué"]);
  });

  it("écrit une seule chose à la fois, dans l'ordre des gestes", async () => {
    const { file } = fileObservee();
    const ordre: string[] = [];
    const premiere = differee();
    file.ajouter({
      appliquer: () => {},
      ecrire: () => {
        ordre.push("début 1");
        return premiere.promesse.then(() => void ordre.push("fin 1"));
      },
      retablir: () => {},
    });
    file.ajouter({
      appliquer: () => {},
      ecrire: async () => void ordre.push("début 2"),
      retablir: () => {},
    });
    await Promise.resolve();
    expect(ordre).toEqual(["début 1"]);
    premiere.reussir();
    await file.terminer();
    expect(ordre).toEqual(["début 1", "fin 1", "début 2"]);
  });

  it("rétablit le geste refusé et signale l'échec", async () => {
    const { file, statuts, erreurs } = fileObservee();
    const journal: string[] = [];
    file.ajouter({
      appliquer: () => journal.push("appliqué"),
      ecrire: () => Promise.reject(new Error("refusé")),
      retablir: () => journal.push("rétabli"),
    });
    await file.terminer();
    expect(journal).toEqual(["appliqué", "rétabli"]);
    expect(statuts.at(-1)).toBe("echec");
    expect(erreurs).toHaveLength(1);
  });

  it("continue après un échec", async () => {
    const { file, statuts } = fileObservee();
    let ecrit = false;
    file.ajouter({
      appliquer: () => {},
      ecrire: () => Promise.reject(new Error("refusé")),
      retablir: () => {},
    });
    file.ajouter({
      appliquer: () => {},
      ecrire: async () => {
        ecrit = true;
      },
      retablir: () => {},
    });
    await file.terminer();
    expect(ecrit).toBe(true);
    // Le premier geste n'est toujours pas enregistré.
    expect(statuts.at(-1)).toBe("echec");
  });

  it("rejoue le geste refusé sur Réessayer", async () => {
    const { file, statuts } = fileObservee();
    const journal: string[] = [];
    let tentatives = 0;
    file.ajouter({
      appliquer: () => journal.push("appliqué"),
      ecrire: async () => {
        tentatives += 1;
        if (tentatives === 1) throw new Error("réseau");
      },
      retablir: () => journal.push("rétabli"),
    });
    await file.terminer();
    file.reessayer();
    await file.terminer();
    expect(journal).toEqual(["appliqué", "rétabli", "appliqué"]);
    expect(tentatives).toBe(2);
    expect(statuts.at(-1)).toBe("enregistre");
  });

  it("ne rejoue rien sans échec", async () => {
    const { file, statuts } = fileObservee();
    file.reessayer();
    await file.terminer();
    expect(statuts).toEqual([]);
  });
});
