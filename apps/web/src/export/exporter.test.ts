import type { LivreARendre } from "@bookopia/shared";
import { describe, expect, it } from "vitest";
import { type DependancesExport, type Etape, exporter } from "./exporter";

const livre: LivreARendre = { fond: "#FFFFFF", doubles_pages: [] };

// Chaque appel est consigné, pour vérifier l'ordre des opérations.
function dependances(
  surcharge: Partial<DependancesExport> = {},
): DependancesExport & { journal: string[] } {
  const journal: string[] = [];
  return {
    journal,
    lireCleExport: async () => "ancienne",
    charger: async (onAvancement) => {
      journal.push("charger");
      onAvancement(1, 1);
      return livre;
    },
    rendre: async () => {
      journal.push("rendre");
      return new Uint8Array([1]);
    },
    nouvelleCle: () => "nouvelle",
    deposerPdf: async (cle) => {
      journal.push(`deposer ${cle}`);
    },
    enregistrerExport: async (cle) => {
      journal.push(`enregistrer ${cle}`);
    },
    supprimerPdf: async (cle) => {
      journal.push(`supprimer ${cle}`);
    },
    ...surcharge,
  };
}

describe("exporter", () => {
  it("dépose, enregistre, puis seulement supprime l'ancien PDF", async () => {
    const dep = dependances();
    expect(await exporter(dep)).toBe("nouvelle");
    expect(dep.journal).toEqual([
      "charger",
      "rendre",
      "deposer nouvelle",
      "enregistrer nouvelle",
      "supprimer ancienne",
    ]);
  });

  it("ne supprime rien quand le livre n'avait pas encore d'export", async () => {
    const dep = dependances({ lireCleExport: async () => null });
    await exporter(dep);
    expect(dep.journal.some((ligne) => ligne.startsWith("supprimer"))).toBe(
      false,
    );
  });

  it("publie les étapes dans l'ordre", async () => {
    const etapes: Etape[] = [];
    await exporter(dependances(), {
      onEtape: (etape) => etapes.push(etape),
    });
    expect(etapes).toEqual([
      { nom: "telechargement", faits: 1, total: 1 },
      { nom: "composition" },
      { nom: "enregistrement" },
    ]);
  });

  it("supprime le PDF déposé si la ligne export est refusée, et garde l'ancien", async () => {
    const dep = dependances({
      enregistrerExport: async () => {
        throw new Error("refus");
      },
    });
    await expect(exporter(dep)).rejects.toThrow("refus");
    expect(dep.journal).toContain("supprimer nouvelle");
    expect(dep.journal).not.toContain("supprimer ancienne");
  });

  it("n'écrit rien si le rendu échoue", async () => {
    const dep = dependances({
      rendre: async () => {
        throw new Error("rendu");
      },
    });
    await expect(exporter(dep)).rejects.toThrow("rendu");
    expect(dep.journal).toEqual(["charger"]);
  });

  it("réussit même si l'ancien PDF ne peut pas être supprimé", async () => {
    const dep = dependances({
      supprimerPdf: async () => {
        throw new Error("stockage");
      },
    });
    expect(await exporter(dep)).toBe("nouvelle");
  });
});
