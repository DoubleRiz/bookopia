import { beforeEach, describe, expect, it, vi } from "vitest";

// Faux client Supabase : le vrai exige des variables d'environnement et un serveur.
const stockage = {
  list: vi.fn(),
  remove: vi.fn(),
};
const supabase = {
  auth: { getSession: vi.fn(), signOut: vi.fn() },
  storage: { from: vi.fn(() => stockage) },
  rpc: vi.fn(),
};
vi.mock("../supabase", () => ({ supabase }));

const UTILISATEUR = "u1";
const fichier = (nom: string) => ({ name: nom, id: `id-${nom}` });
const fichiers = (nombre: number, debut = 0) =>
  Array.from({ length: nombre }, (_, rang) => fichier(`f${debut + rang}.jpg`));

// Le module garde un drapeau de purge : on le recharge pour chaque test.
async function charger() {
  vi.resetModules();
  return import("./compte");
}

beforeEach(() => {
  vi.clearAllMocks();
  supabase.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: UTILISATEUR } } },
    error: null,
  });
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.rpc.mockResolvedValue({ data: null, error: null, status: 204 });
  stockage.list.mockResolvedValue({ data: [], error: null });
  stockage.remove.mockResolvedValue({ data: [], error: null });
});

describe("supprimerCompte", () => {
  it("lit toutes les pages d'un dossier, même quand une page est pleine", async () => {
    const { supprimerCompte } = await charger();
    // Une page d'exactement TAILLE_PAGE entrées oblige à demander la suivante, qui est vide.
    stockage.list.mockImplementation(
      (_dossier: string, option: { offset: number }) =>
        Promise.resolve({
          data: option.offset === 0 ? fichiers(1000) : [],
          error: null,
        }),
    );
    await supprimerCompte();
    const decalages = stockage.list.mock.calls
      .filter(([dossier]) => dossier === UTILISATEUR)
      .map(([, option]) => option.offset);
    // photos puis exports : deux pages demandées chacun.
    expect(decalages).toEqual([0, 1000, 0, 1000]);
  });

  it("supprime les fichiers par lots de 100, avant d'appeler la fonction SQL", async () => {
    const { supprimerCompte } = await charger();
    stockage.list.mockImplementation(
      (_dossier: string, option: { offset: number }) =>
        Promise.resolve({
          data: option.offset === 0 ? fichiers(103) : [],
          error: null,
        }),
    );
    const ordre: string[] = [];
    stockage.remove.mockImplementation((lot: string[]) => {
      ordre.push(`remove:${lot.length}`);
      return Promise.resolve({ data: [], error: null });
    });
    supabase.rpc.mockImplementation(() => {
      ordre.push("rpc");
      return Promise.resolve({ data: null, error: null, status: 204 });
    });
    await supprimerCompte();
    // 103 fichiers dans chacun des deux buckets, puis la fonction SQL en dernier.
    expect(ordre).toEqual([
      "remove:100",
      "remove:3",
      "remove:100",
      "remove:3",
      "rpc",
    ]);
    expect(supabase.rpc).toHaveBeenCalledWith("supprimer_mon_compte");
  });

  it("s'arrête sans supprimer le compte si un fichier résiste", async () => {
    const { supprimerCompte } = await charger();
    stockage.list.mockResolvedValue({ data: [fichier("a.jpg")], error: null });
    stockage.remove.mockResolvedValue({
      data: null,
      error: { message: "refusé" },
    });
    await expect(supprimerCompte()).rejects.toThrow("refusé");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("réussit même si l'effacement de la session locale échoue", async () => {
    const { supprimerCompte } = await charger();
    supabase.auth.signOut.mockRejectedValue(new Error("session introuvable"));
    await expect(supprimerCompte()).resolves.toBeUndefined();
  });

  it("refuse sans session", async () => {
    const { supprimerCompte } = await charger();
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    await expect(supprimerCompte()).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe("purgerOrphelins", () => {
  it("supprime les orphelins de chaque bucket", async () => {
    const { purgerOrphelins } = await charger();
    supabase.rpc.mockResolvedValue({
      data: [
        { bucket_id: "photos", chemin: "u1/p/originaux/a.jpg" },
        { bucket_id: "exports", chemin: "u1/p/b.pdf" },
      ],
      error: null,
      status: 200,
    });
    await purgerOrphelins();
    expect(supabase.storage.from).toHaveBeenCalledWith("photos");
    expect(supabase.storage.from).toHaveBeenCalledWith("exports");
    expect(stockage.remove).toHaveBeenCalledWith(["u1/p/originaux/a.jpg"]);
    expect(stockage.remove).toHaveBeenCalledWith(["u1/p/b.pdf"]);
  });

  it("ne lève jamais d'erreur et se rejoue au chargement suivant", async () => {
    const { purgerOrphelins } = await charger();
    supabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "XX000", message: "panne", details: null },
      status: 500,
    });
    await expect(purgerOrphelins()).resolves.toBeUndefined();
    // L'échec n'a pas consommé la purge de cette page : l'appel suivant réessaie.
    await purgerOrphelins();
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("ne purge qu'une fois par chargement de page", async () => {
    const { purgerOrphelins } = await charger();
    await purgerOrphelins();
    await purgerOrphelins();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});
