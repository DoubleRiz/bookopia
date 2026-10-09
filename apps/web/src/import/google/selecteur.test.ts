import { describe, expect, it } from "vitest";
import {
  attendreSelection,
  creerSession,
  ErreurGoogleNonAutorise,
  ErreurSelecteurExpire,
  listerMedias,
  type MediaGoogle,
  type SessionSelecteur,
  telecharger,
} from "./selecteur";

const json = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut });

const session = (
  surcharge: Partial<SessionSelecteur> = {},
): SessionSelecteur => ({
  id: "s1",
  pickerUri: "https://photos.google.com/picker/s1",
  mediaItemsSet: false,
  intervalleMs: 5000,
  delaiMs: 60_000,
  ...surcharge,
});

const media = (nom: string): MediaGoogle => ({
  id: nom,
  createTime: "2026-10-01T10:00:00Z",
  type: "PHOTO",
  mediaFile: {
    baseUrl: `https://lh3.googleusercontent.com/${nom}`,
    mimeType: "image/jpeg",
    filename: `${nom}.jpg`,
  },
});

describe("selecteur", () => {
  it("crée une session et lit le rythme de suivi", async () => {
    const appels: [string, RequestInit | undefined][] = [];
    const reponse = await creerSession("jeton", {
      fetch: async (adresse, init) => {
        appels.push([String(adresse), init]);
        return json({
          id: "s1",
          pickerUri: "https://photos.google.com/picker/s1",
          pollingConfig: { pollInterval: "3.5s", timeoutIn: "1800s" },
        });
      },
    });
    expect(appels[0]?.[0]).toBe(
      "https://photospicker.googleapis.com/v1/sessions",
    );
    expect(appels[0]?.[1]?.method).toBe("POST");
    expect(reponse).toMatchObject({
      id: "s1",
      mediaItemsSet: false,
      intervalleMs: 3500,
      delaiMs: 1_800_000,
    });
  });

  it("suit la session jusqu'à la validation", async () => {
    const reponses = [{ mediaItemsSet: false }, { mediaItemsSet: true }];
    const attentes: number[] = [];
    const fin = await attendreSelection("jeton", session(), {
      fetch: async () =>
        json({ id: "s1", pickerUri: "x", ...reponses.shift() }),
      dormir: async (ms) => {
        attentes.push(ms);
      },
    });
    expect(fin?.mediaItemsSet).toBe(true);
    expect(fin?.pickerUri).toBe("https://photos.google.com/picker/s1");
    expect(attentes).toEqual([5000, 5000]);
  });

  it("expire à timeoutIn", async () => {
    let horloge = 0;
    await expect(
      attendreSelection("jeton", session({ delaiMs: 12_000 }), {
        fetch: async () => json({ id: "s1", pickerUri: "x" }),
        dormir: async (ms) => {
          horloge += ms;
        },
        maintenant: () => horloge,
      }),
    ).rejects.toBeInstanceOf(ErreurSelecteurExpire);
  });

  it("s'arrête, sans erreur, quand l'attente est annulée", async () => {
    const controleur = new AbortController();
    const fin = await attendreSelection("jeton", session(), {
      signal: controleur.signal,
      fetch: async () => json({ id: "s1", pickerUri: "x" }),
      dormir: async () => controleur.abort(),
    });
    expect(fin).toBeNull();
  });

  it("parcourt toutes les pages de médias", async () => {
    const adresses: string[] = [];
    const medias = await listerMedias("jeton", "s1", {
      fetch: async (adresse) => {
        adresses.push(String(adresse));
        return adresses.length === 1
          ? json({ mediaItems: [media("a")], nextPageToken: "p2" })
          : json({ mediaItems: [media("b")] });
      },
    });
    expect(medias.map((m) => m.id)).toEqual(["a", "b"]);
    expect(adresses[1]).toContain("pageToken=p2");
    expect(adresses[0]).toContain("sessionId=s1");
  });

  it("télécharge l'original avec le jeton et rend un File nommé et daté", async () => {
    let requete: { adresse: string; init?: RequestInit } | undefined;
    const fichier = await telecharger("jeton", media("a"), {
      fetch: async (adresse, init) => {
        requete = { adresse: String(adresse), init };
        return new Response(new Blob(["octets"]), { status: 200 });
      },
    });
    expect(requete?.adresse).toBe("https://lh3.googleusercontent.com/a=d");
    expect(requete?.init?.headers).toEqual({ Authorization: "Bearer jeton" });
    expect(fichier.name).toBe("a.jpg");
    expect(fichier.type).toBe("image/jpeg");
    expect(fichier.lastModified).toBe(Date.parse("2026-10-01T10:00:00Z"));
  });

  it("traduit un 401 en erreur dédiée", async () => {
    await expect(
      telecharger("jeton", media("a"), {
        fetch: async () => new Response(null, { status: 401 }),
      }),
    ).rejects.toBeInstanceOf(ErreurGoogleNonAutorise);
  });
});
