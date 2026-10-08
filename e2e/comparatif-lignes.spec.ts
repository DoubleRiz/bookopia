import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CATALOGUE_POLICES,
  creerMesure,
  disposerTexte,
  FICHIERS_POLICES,
  type Mesures,
  type Theme,
} from "@bookopia/shared";
import { expect, test } from "@playwright/test";
import { appliquerGabarit, creerLivreRaconte, ecrire } from "./parcours";

// Le thème Carnet du catalogue de départ (supabase/seed.sql).
const carnet: Theme = {
  palette: { fond: "#FFF5E6", texte: "#2F4A80" },
  bordure_cadre: { filet_pt: 0.5 },
  typographie: {
    titre: { police: "Nunito", graisse: 700, italique: false, taille_pt: 15 },
    legende: { police: "Caveat", graisse: 600, italique: false, taille_pt: 15 },
    alignement: "exterieur",
    ancrage: "bas",
    styles_masques: [],
  },
};

const mesures: Mesures = (cle) =>
  creerMesure(
    readFileSync(
      fileURLToPath(
        new URL(
          `../packages/shared/polices/${FICHIERS_POLICES[cle]}`,
          import.meta.url,
        ),
      ),
    ),
  );

const TEXTE =
  "Le phare de Ploumanac'h veille sur la côte rose, et la marée monte doucement entre les rochers. Un affichage fluide, efficace et officiel : fin de journée.";

// Les lignes que le navigateur a faites : les caractères groupés par ligne de base.
function lignesDuNavigateur(): string[] {
  const racine = document.querySelector(".ProseMirror");
  if (!racine) return [];
  const lignes = new Map<number, string>();
  const parcours = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  for (let noeud = parcours.nextNode(); noeud; noeud = parcours.nextNode()) {
    const texte = noeud.textContent ?? "";
    for (let i = 0; i < texte.length; i++) {
      const plage = document.createRange();
      plage.setStart(noeud, i);
      plage.setEnd(noeud, i + 1);
      const rect = plage.getClientRects()[0];
      if (!rect) continue;
      const cle = Math.round(rect.bottom);
      lignes.set(cle, (lignes.get(cle) ?? "") + texte[i]);
    }
  }
  return [...lignes.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, l]) => l.trim());
}

test("le navigateur et le module partagé coupent les lignes au même endroit", async ({
  page,
}) => {
  await creerLivreRaconte(page);
  await appliquerGabarit(page, "Photo et bloc texte");
  const cadre = page.getByRole("button", { name: /^Légende 3,/ });
  const dimensions = {
    x: Number(await cadre.getAttribute("x")),
    y: Number(await cadre.getAttribute("y")),
    largeur: Number(await cadre.getAttribute("width")),
    hauteur: Number(await cadre.getAttribute("height")),
  };

  await ecrire(page, "Légende 3", "");
  await page.keyboard.insertText(TEXTE);
  const barre = page.getByRole("toolbar", { name: "Mise en forme du texte" });

  const familles = Object.keys(
    CATALOGUE_POLICES,
  ) as (keyof typeof CATALOGUE_POLICES)[];
  const ecarts: string[] = [];
  for (const famille of familles) {
    await page.keyboard.press("ControlOrMeta+A");
    await barre.getByRole("button", { name: /^Police/ }).click();
    await page.getByRole("option", { name: famille, exact: true }).click();
    // La police se charge avant de s'appliquer : on attend que la barre la montre.
    await expect(barre.getByRole("button", { name: /^Police/ })).toHaveText(
      famille,
    );
    await page.evaluate(() => document.fonts.ready);
    // Le texte tient dans le cadre pour chaque police : sinon la saisie l'a refusé.
    const attendu = disposerTexte(
      {
        ...dimensions,
        style_texte: "legende",
        contenu_texte: {
          version: 1,
          blocs: [
            {
              type: "paragraphe",
              segments: [
                {
                  texte: TEXTE,
                  ...(famille === "Caveat" ? {} : { police: famille }),
                },
              ],
            },
          ],
        },
      },
      carnet,
      mesures,
    ).lignes.map((ligne) =>
      ligne.fragments
        .map((fragment) => fragment.texte)
        .join("")
        .trim(),
    );
    const obtenu = await page.evaluate(lignesDuNavigateur);
    if (JSON.stringify(obtenu) !== JSON.stringify(attendu)) {
      ecarts.push(
        `${famille}\n  navigateur : ${JSON.stringify(obtenu)}\n  module     : ${JSON.stringify(attendu)}`,
      );
    }
  }
  expect(ecarts, ecarts.join("\n")).toEqual([]);
});
