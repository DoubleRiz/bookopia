# Écran d'export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer l'écran E9 (`/livre/:id/export`) : contrôles avant rendu (cadres photo sous 150 DPI, cadres photo vides), progression, téléchargement, ancien PDF conservé.

**Architecture:** Une fonction pure `controlerExport` dans `packages/shared` calcule les deux listes à partir de `dpiEffectif` et `niveauResolution`. L'écran se découpe en un loader plus un conteneur à état (`Export.tsx`, qui appelle `exporter` inchangé) et une vue sans état (`VueExport.tsx`, testée par rendu statique). Le bloc provisoire `ExportDuLivre` disparaît de `LivreEnCours`, qui garde un lien vers E9.

**Tech Stack:** React · react-router · TypeScript · Vitest (`renderToStaticMarkup`) · Playwright · supabase-js

**Spec:** [`docs/superpowers/specs/2026-10-08-ecran-export-design.md`](../specs/2026-10-08-ecran-export-design.md)

## Global Constraints

- Tout est en français : code, commentaires, commits, interface. Vocabulaire littéral : `double_page`, `emplacement`, `gabarit`, `reserve`. Jamais « page », « layout », « template » comme identifiants.
- Aucune dépendance nouvelle.
- Seuil : `niveauResolution(dpi) === "faible"`, c'est-à-dire strictement sous 150 DPI. Aucune constante nouvelle.
- Rien ne bloque l'export : le bouton reste actif quelle que soit la liste.
- Un cadre texte n'est jamais listé, vide ou non.
- Les cadres entre 150 et 300 DPI ne sont pas listés.
- Le DPI est conservé non arrondi dans le résultat, l'écran l'arrondit.
- Adresse du lien : `/livre/:id?page=<double_page_id>` (déjà lue par l'éditeur).
- Avant tout commit : `npm run lint && npm run typecheck`, puis `npm test`.
- Commits en français, à la fin desquels on ajoute :
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
- Ne pas modifier `docs/` en dehors de ce plan et du spec.

## Review Focus

- **Photo posée sans cadrage** (colonnes `cadrage_*` nulles) : traitée comme le neutre `0.5 / 0.5 / 1`, jamais de `NaN` ni d'exception. Test dans la tâche 1.
- **Double page sans aucun emplacement** : aucune entrée, pas d'erreur. Test dans la tâche 1.
- **Cadre au bord de la double page** : le fond perdu compte (3 mm de plus), donc un cadre à 152 DPI sans fond perdu passe sous 150 avec. Test dans la tâche 1.
- **Échec d'un nouvel export alors qu'un PDF existe** : le lien « Télécharger le PDF » reste affiché sous la bannière d'échec. Test dans la tâche 2.
- **Livre jamais exporté ou livre modifié depuis le dernier PDF** : les messages ne se confondent pas (« pas encore exporté » contre « a changé depuis »). Test dans la tâche 2.
- **Identifiant de livre mal formé ou livre d'un autre** : la même réponse 404 que l'éditeur. Vérifié dans la tâche 3.

---

### Task 1: `controlerExport` dans `packages/shared`

**Files:**
- Create: `packages/shared/src/controle-export.ts`
- Create: `packages/shared/src/controle-export.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `dpiEffectif`, `niveauResolution` de `./cadrage` (déjà exportés).
- Produces (utilisés par les tâches 2 et 3) :

```ts
export type EmplacementAControler = {
  id: string;
  nature: "photo" | "texte";
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  cadrage_x: number | null;
  cadrage_y: number | null;
  cadrage_zoom: number | null;
  photo: { largeur_px: number; hauteur_px: number } | null;
};
export type DoublePageAControler = {
  id: string;
  emplacements: EmplacementAControler[];
};
export type ControleExport = {
  faibles: { double_page_id: string; emplacement_id: string; dpi: number }[];
  vides: { double_page_id: string; emplacement_id: string }[];
};
export function controlerExport(doublesPages: DoublePageAControler[]): ControleExport;
```

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `packages/shared/src/controle-export.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  controlerExport,
  type DoublePageAControler,
  type EmplacementAControler,
} from "./controle-export";

function emplacement(
  autres: Partial<EmplacementAControler>,
): EmplacementAControler {
  return {
    id: "e",
    nature: "photo",
    x: 20,
    y: 20,
    largeur: 100,
    hauteur: 50,
    cadrage_x: 0.5,
    cadrage_y: 0.5,
    cadrage_zoom: 1,
    photo: { largeur_px: 1200, hauteur_px: 800 },
    ...autres,
  };
}

function doublePage(
  id: string,
  emplacements: EmplacementAControler[],
): DoublePageAControler {
  return { id, emplacements };
}

describe("controlerExport", () => {
  it("ne signale rien quand tous les cadres sont à 300 DPI ou plus", () => {
    // 1200 px sur 100 mm : 304,8 DPI.
    expect(
      controlerExport([doublePage("d1", [emplacement({ id: "e1" })])]),
    ).toEqual({ faibles: [], vides: [] });
  });

  it("liste un cadre photo sous 150 DPI avec son DPI non arrondi", () => {
    // 400 px sur 100 mm : 101,6 DPI.
    const { faibles, vides } = controlerExport([
      doublePage("d1", [
        emplacement({ id: "e1", photo: { largeur_px: 400, hauteur_px: 300 } }),
      ]),
    ]);
    expect(vides).toEqual([]);
    expect(faibles).toHaveLength(1);
    expect(faibles[0]).toMatchObject({
      double_page_id: "d1",
      emplacement_id: "e1",
    });
    expect(faibles[0]?.dpi).toBeCloseTo(101.6, 1);
  });

  it("ne liste pas un cadre entre 150 et 300 DPI", () => {
    // 600 px sur 100 mm : 152,4 DPI, avertissement doux de l'éditeur seulement.
    expect(
      controlerExport([
        doublePage("d1", [
          emplacement({ photo: { largeur_px: 600, hauteur_px: 400 } }),
        ]),
      ]).faibles,
    ).toEqual([]);
  });

  it("compte le zoom : un bon cadre zoomé peut passer sous 150 DPI", () => {
    // 1200 px, zoom 3 : 400 px visibles sur 100 mm.
    const { faibles } = controlerExport([
      doublePage("d1", [emplacement({ id: "e1", cadrage_zoom: 3 })]),
    ]);
    expect(faibles.map((f) => f.emplacement_id)).toEqual(["e1"]);
  });

  it("compte le fond perdu d'un cadre au bord de la double page", () => {
    // 600 px sur 100 mm : 152,4 DPI dans la zone utile, 148 DPI avec 3 mm de fond perdu.
    const { faibles } = controlerExport([
      doublePage("d1", [
        emplacement({
          id: "e1",
          x: 0,
          y: 0,
          photo: { largeur_px: 600, hauteur_px: 400 },
        }),
      ]),
    ]);
    expect(faibles).toHaveLength(1);
    expect(faibles[0]?.dpi).toBeCloseTo(147.96, 1);
  });

  it("liste un cadre photo sans photo comme vide", () => {
    expect(
      controlerExport([
        doublePage("d1", [emplacement({ id: "e1", photo: null })]),
      ]),
    ).toEqual({
      faibles: [],
      vides: [{ double_page_id: "d1", emplacement_id: "e1" }],
    });
  });

  it("ne liste jamais un cadre texte, vide ou non", () => {
    expect(
      controlerExport([
        doublePage("d1", [
          emplacement({ id: "t", nature: "texte", photo: null }),
        ]),
      ]),
    ).toEqual({ faibles: [], vides: [] });
  });

  it("prend le cadrage neutre quand une photo posée n'en a pas", () => {
    const { faibles, vides } = controlerExport([
      doublePage("d1", [
        emplacement({
          id: "e1",
          cadrage_x: null,
          cadrage_y: null,
          cadrage_zoom: null,
          photo: { largeur_px: 400, hauteur_px: 300 },
        }),
      ]),
    ]);
    expect(vides).toEqual([]);
    expect(faibles[0]?.dpi).toBeCloseTo(101.6, 1);
  });

  it("accepte une double page sans emplacement", () => {
    expect(controlerExport([doublePage("d1", [])])).toEqual({
      faibles: [],
      vides: [],
    });
  });

  it("garde l'ordre du livre : doubles pages, puis emplacements", () => {
    const pauvre = { largeur_px: 400, hauteur_px: 300 };
    const { faibles, vides } = controlerExport([
      doublePage("d1", [
        emplacement({ id: "a", photo: pauvre }),
        emplacement({ id: "b", photo: null }),
      ]),
      doublePage("d2", [
        emplacement({ id: "c", photo: null }),
        emplacement({ id: "d", photo: pauvre }),
      ]),
    ]);
    expect(faibles.map((f) => f.emplacement_id)).toEqual(["a", "d"]);
    expect(vides.map((v) => v.emplacement_id)).toEqual(["b", "c"]);
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx vitest run packages/shared/src/controle-export.test.ts`
Expected: FAIL, le module `./controle-export` n'existe pas.

- [ ] **Step 3: Écrire l'implémentation**

Créer `packages/shared/src/controle-export.ts` :

```ts
import { dpiEffectif, niveauResolution } from "./cadrage";

export type EmplacementAControler = {
  id: string;
  nature: "photo" | "texte";
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  cadrage_x: number | null;
  cadrage_y: number | null;
  cadrage_zoom: number | null;
  photo: { largeur_px: number; hauteur_px: number } | null;
};

export type DoublePageAControler = {
  id: string;
  emplacements: EmplacementAControler[];
};

export type ControleExport = {
  faibles: { double_page_id: string; emplacement_id: string; dpi: number }[];
  vides: { double_page_id: string; emplacement_id: string }[];
};

// Ce que le Créateur doit savoir avant de lancer le rendu : les cadres photo sous 150 DPI
// et ceux restés vides (RG-20). Rien de tout cela ne bloque l'export (RG-16).
// Les cadres texte ne comptent pas : un texte absent est un choix valable.
// Les listes suivent l'ordre reçu, c'est-à-dire celui du livre.
export function controlerExport(
  doublesPages: DoublePageAControler[],
): ControleExport {
  const resultat: ControleExport = { faibles: [], vides: [] };
  for (const doublePage of doublesPages) {
    for (const emplacement of doublePage.emplacements) {
      if (emplacement.nature !== "photo") continue;
      const { photo } = emplacement;
      if (!photo) {
        resultat.vides.push({
          double_page_id: doublePage.id,
          emplacement_id: emplacement.id,
        });
        continue;
      }
      // Une photo posée a toujours un cadrage (contrainte de la base) : le neutre n'est qu'un filet.
      const dpi = dpiEffectif(
        {
          x: emplacement.x,
          y: emplacement.y,
          largeur: emplacement.largeur,
          hauteur: emplacement.hauteur,
          cadrage_x: emplacement.cadrage_x ?? 0.5,
          cadrage_y: emplacement.cadrage_y ?? 0.5,
          cadrage_zoom: emplacement.cadrage_zoom ?? 1,
        },
        photo,
      );
      if (niveauResolution(dpi) === "faible") {
        resultat.faibles.push({
          double_page_id: doublePage.id,
          emplacement_id: emplacement.id,
          dpi,
        });
      }
    }
  }
  return resultat;
}
```

- [ ] **Step 4: Exporter depuis l'index**

Dans `packages/shared/src/index.ts`, ajouter après la ligne `export * from "./composition";` :

```ts
export * from "./controle-export";
```

- [ ] **Step 5: Lancer les tests pour les voir passer**

Run: `npx vitest run packages/shared/src/controle-export.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Vérifier et commiter**

Run: `npm run lint && npm run typecheck`
Expected: aucune erreur.

```bash
git add packages/shared/src/controle-export.ts packages/shared/src/controle-export.test.ts packages/shared/src/index.ts
git commit -m "ajoute le contrôle des cadres photo faibles et vides avant l'export

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `VueExport`, la vue sans état de l'écran E9

**Files:**
- Create: `apps/web/src/ecrans/VueExport.tsx`
- Create: `apps/web/src/ecrans/VueExport.test.tsx`
- Create: `apps/web/src/ecrans/Export.module.css`

**Interfaces:**
- Consumes: `ControleExport` (tâche 1) ; `Etape` de `../export/exporter` ; `Banniere` ; `Bouton`.
- Produces (utilisé par la tâche 3) :

```ts
export type EtatExport = "demande" | "en_cours" | "disponible" | "echec";
export function VueExport(props: {
  projet: { id: string; titre: string };
  controle: ControleExport;
  libelles: Record<string, string>; // double_page_id -> « Couverture », « Pages 2 et 3 »…
  etat: EtatExport;
  etape: Etape | null;     // renseigné seulement en cours
  message: string | null;  // renseigné seulement en échec
  urlDuPdf: string | null; // PDF existant, y compris pendant un rendu ou après un échec
  aJour: boolean;          // le PDF existant date d'après la dernière modification du livre
  surExporter: () => void;
}): JSX.Element;
```

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `apps/web/src/ecrans/VueExport.test.tsx` :

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { VueExport } from "./VueExport";

type Props = Parameters<typeof VueExport>[0];

const BASE: Props = {
  projet: { id: "p1", titre: "Vacances" },
  controle: { faibles: [], vides: [] },
  libelles: { d1: "Couverture", d2: "Pages 2 et 3" },
  etat: "demande",
  etape: null,
  message: null,
  urlDuPdf: null,
  aJour: false,
  surExporter: () => undefined,
};

function rendre(autres: Partial<Props>): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <VueExport {...BASE} {...autres} />
    </MemoryRouter>,
  );
}

describe("VueExport", () => {
  it("dit quand il n'y a rien à vérifier", () => {
    expect(rendre({})).toContain("Aucun point à vérifier");
  });

  it("liste les cadres faibles avec un lien vers la double page", () => {
    const html = rendre({
      controle: {
        faibles: [{ double_page_id: "d2", emplacement_id: "e1", dpi: 101.6 }],
        vides: [],
      },
    });
    expect(html).toContain("Cadres sous 150 DPI");
    expect(html).toContain('href="/livre/p1?page=d2"');
    expect(html).toContain("Pages 2 et 3");
    expect(html).toContain("102 DPI");
  });

  it("liste les cadres photo vides avec un lien vers la double page", () => {
    const html = rendre({
      controle: {
        faibles: [],
        vides: [{ double_page_id: "d1", emplacement_id: "e1" }],
      },
    });
    expect(html).toContain("Cadres photo vides");
    expect(html).toContain('href="/livre/p1?page=d1"');
    expect(html).toContain("Couverture");
  });

  it("n'empêche jamais d'exporter, même avec des points à vérifier", () => {
    const html = rendre({
      controle: {
        faibles: [{ double_page_id: "d1", emplacement_id: "e1", dpi: 90 }],
        vides: [{ double_page_id: "d2", emplacement_id: "e2" }],
      },
    });
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Exporter le PDF/);
  });

  it("demandé : jamais exporté, pas de lien de téléchargement", () => {
    const html = rendre({ etat: "demande" });
    expect(html).toContain("pas encore été exporté");
    expect(html).toContain("Exporter le PDF");
    expect(html).not.toContain("Télécharger le PDF");
  });

  it("en cours : montre l'étape et désactive le bouton", () => {
    const html = rendre({
      etat: "en_cours",
      etape: { nom: "telechargement", faits: 2, total: 5 },
    });
    expect(html).toContain("Téléchargement des photos 2 sur 5");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("en cours avec un ancien PDF : l'ancien reste téléchargeable", () => {
    const html = rendre({
      etat: "en_cours",
      etape: { nom: "composition" },
      urlDuPdf: "http://pdf/ancien",
      aJour: true,
    });
    expect(html).toContain("Composition du PDF");
    expect(html).toContain('href="http://pdf/ancien"');
    expect(html).toContain("Télécharger le PDF");
  });

  it("disponible et à jour", () => {
    const html = rendre({
      etat: "disponible",
      urlDuPdf: "http://pdf/1",
      aJour: true,
    });
    expect(html).toContain("PDF à jour");
    expect(html).toContain("Exporter à nouveau");
    expect(html).toContain('href="http://pdf/1"');
  });

  it("disponible mais le livre a changé depuis", () => {
    const html = rendre({
      etat: "disponible",
      urlDuPdf: "http://pdf/1",
      aJour: false,
    });
    expect(html).toContain("Le livre a changé depuis ce PDF");
    expect(html).not.toContain("pas encore été exporté");
  });

  it("échec : message, et l'ancien PDF reste téléchargeable", () => {
    const html = rendre({
      etat: "echec",
      message: "Le serveur ne répond pas.",
      urlDuPdf: "http://pdf/ancien",
      aJour: false,
    });
    expect(html).toContain("Le serveur ne répond pas.");
    expect(html).toContain('href="http://pdf/ancien"');
    expect(html).toContain("Exporter à nouveau");
  });

  it("échec sans ancien PDF : propose de réessayer", () => {
    const html = rendre({ etat: "echec", message: "L'export a échoué." });
    expect(html).toContain("L&#x27;export a échoué.");
    expect(html).toContain("Exporter le PDF");
    expect(html).not.toContain("Télécharger le PDF");
  });
});
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx vitest run apps/web/src/ecrans/VueExport.test.tsx`
Expected: FAIL, le module `./VueExport` n'existe pas.

- [ ] **Step 3: Écrire le CSS**

Créer `apps/web/src/ecrans/Export.module.css` :

```css
.entete {
  display: flex;
  flex-direction: column;
  gap: var(--espace-2);
  min-width: 0;
}

.entete h1 {
  overflow-wrap: anywhere;
}

.retour {
  color: var(--couleur-texte-secondaire);
  font-size: var(--taille-petit);
  font-weight: 600;
  text-decoration: none;
}

.retour:hover {
  color: var(--couleur-encre);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--espace-4);
  margin-top: var(--espace-6);
}

.note {
  margin: 0;
  color: var(--couleur-texte-secondaire);
  font-size: 14px;
}

.liste {
  display: flex;
  flex-direction: column;
  gap: var(--espace-2);
  margin: 0;
  padding-left: var(--espace-4);
}

.liste a {
  color: var(--couleur-encre);
  font-weight: 600;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--espace-3);
}

.telechargement {
  color: var(--couleur-encre);
  font-weight: 700;
}

.etat {
  min-height: 1.5em;
  margin: 0;
  color: var(--couleur-texte-secondaire);
  font-size: 14px;
}
```

- [ ] **Step 4: Écrire la vue**

Créer `apps/web/src/ecrans/VueExport.tsx` :

```tsx
import type { ControleExport } from "@bookopia/shared";
import { Link } from "react-router";
import { Banniere } from "../composants/Banniere";
import { Bouton } from "../composants/Bouton";
import type { Etape } from "../export/exporter";
import styles from "./Export.module.css";

export type EtatExport = "demande" | "en_cours" | "disponible" | "echec";

function libelleEtape(etape: Etape | null): string {
  if (!etape || etape.nom === "telechargement") {
    return etape
      ? `Téléchargement des photos ${etape.faits} sur ${etape.total}`
      : "Préparation";
  }
  return etape.nom === "composition" ? "Composition du PDF" : "Enregistrement";
}

function libelleEtat(etat: EtatExport, etape: Etape | null, aJour: boolean) {
  if (etat === "en_cours") return libelleEtape(etape);
  if (etat === "demande") return "Ce livre n'a pas encore été exporté.";
  if (etat === "disponible") {
    return aJour ? "PDF à jour." : "Le livre a changé depuis ce PDF.";
  }
  return "";
}

// E9 : ce que le Créateur voit. Le conteneur (Export.tsx) lui donne l'état et l'action.
// Les contrôles avertissent, ils ne bloquent jamais le bouton (RG-16).
export function VueExport({
  projet,
  controle,
  libelles,
  etat,
  etape,
  message,
  urlDuPdf,
  aJour,
  surExporter,
}: {
  projet: { id: string; titre: string };
  controle: ControleExport;
  libelles: Record<string, string>;
  etat: EtatExport;
  etape: Etape | null;
  message: string | null;
  urlDuPdf: string | null;
  aJour: boolean;
  surExporter: () => void;
}) {
  const enCours = etat === "en_cours";
  const rienAVerifier =
    controle.faibles.length === 0 && controle.vides.length === 0;
  const lien = (doublePageId: string) => (
    <Link to={`/livre/${projet.id}?page=${doublePageId}`}>
      {libelles[doublePageId] ?? "Double page"}
    </Link>
  );

  return (
    <>
      <div className={styles.entete}>
        <Link to={`/livre/${projet.id}`} className={styles.retour}>
          ← {projet.titre}
        </Link>
        <h1>Export</h1>
      </div>

      <section className={styles.section} aria-labelledby="titre-controles">
        <h2 id="titre-controles">Avant l'export</h2>
        {rienAVerifier ? (
          <p className={styles.note}>Aucun point à vérifier.</p>
        ) : (
          <>
            <p className={styles.note}>
              Ces points n'empêchent pas l'export.
            </p>
            {controle.faibles.length > 0 && (
              <>
                <h3>Cadres sous 150 DPI</h3>
                <ul className={styles.liste}>
                  {controle.faibles.map((faible) => (
                    <li key={faible.emplacement_id}>
                      {lien(faible.double_page_id)} · {Math.round(faible.dpi)}{" "}
                      DPI
                    </li>
                  ))}
                </ul>
              </>
            )}
            {controle.vides.length > 0 && (
              <>
                <h3>Cadres photo vides</h3>
                <ul className={styles.liste}>
                  {controle.vides.map((vide) => (
                    <li key={vide.emplacement_id}>
                      {lien(vide.double_page_id)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      <section className={styles.section} aria-labelledby="titre-rendu">
        <h2 id="titre-rendu">PDF</h2>
        {etat === "echec" && message && <Banniere titre={message} />}
        <div className={styles.actions}>
          <Bouton onClick={surExporter} enCours={enCours} disabled={enCours}>
            {urlDuPdf ? "Exporter à nouveau" : "Exporter le PDF"}
          </Bouton>
          {urlDuPdf && (
            <a className={styles.telechargement} href={urlDuPdf}>
              Télécharger le PDF
            </a>
          )}
        </div>
        <p className={styles.etat} aria-live="polite">
          {libelleEtat(etat, etape, aJour)}
        </p>
      </section>
    </>
  );
}
```

Note : en échec, `libelleEtat` renvoie une chaîne vide, la bannière porte le message.

- [ ] **Step 5: Lancer les tests pour les voir passer**

Run: `npx vitest run apps/web/src/ecrans/VueExport.test.tsx`
Expected: PASS, 11 tests. Si le test du bouton actif (`<button(?![^>]*disabled)`) échoue à cause de l'ordre des attributs, adapter l'expression régulière au HTML réellement produit sans changer l'intention : le bouton « Exporter le PDF » ne porte pas `disabled`.

- [ ] **Step 6: Vérifier et commiter**

Run: `npm run lint && npm run typecheck`
Expected: aucune erreur. `ExportDuLivre.tsx` existe encore et n'est pas touché ici.

```bash
git add apps/web/src/ecrans/VueExport.tsx apps/web/src/ecrans/VueExport.test.tsx apps/web/src/ecrans/Export.module.css
git commit -m "ajoute la vue de l'écran d'export avec ses contrôles et ses états

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Loader, conteneur, route, et retrait du bloc provisoire

**Files:**
- Modify: `apps/web/src/api/exports.ts` (ajouter deux lectures)
- Create: `apps/web/src/ecrans/Export.tsx`
- Modify: `apps/web/src/routeur.tsx` (importer l'écran, ajouter la route)
- Modify: `apps/web/src/ecrans/LivreEnCours.tsx` (lien à la place du bloc, loader allégé)
- Modify: `apps/web/src/ecrans/LivreEnCours.module.css` (retirer `.export`, `.actionsExport`, `.telechargement`, `.etat` ; ajouter `.lienExport`)
- Delete: `apps/web/src/ecrans/ExportDuLivre.tsx`

**Interfaces:**
- Consumes: `controlerExport`, `DoublePageAControler` (tâche 1) ; `VueExport`, `EtatExport` (tâche 2) ; `exporter`, `Etape` ; `dependancesExport` ; `lireExport`, `cheminPdf`, `urlDuPdf` ; `libelleDoublePage` de `../composants/DoublePage` ; `sousSession` de `../session`.
- Produces : `chargerExport(args: LoaderFunctionArgs)` et `Export()` exportés de `Export.tsx`, route `/livre/:id/export`.

- [ ] **Step 1: Ajouter les lectures à `api/exports.ts`**

Dans `apps/web/src/api/exports.ts`, remplacer la première ligne d'import :

```ts
import { themeSchema } from "@bookopia/shared";
```

par :

```ts
import { type DoublePageAControler, themeSchema } from "@bookopia/shared";
```

puis ajouter, après la fonction `lireLivreARendre` :

```ts
// Le livre pour l'écran d'export : de quoi nommer le livre, signer son PDF et dire s'il est à jour.
// Un identifiant inconnu ou celui d'un autre : null, la RLS ne laisse rien voir.
export async function lireProjetPourExport(projetId: string) {
  return verifier(
    await supabase
      .from("projet")
      .select("id, titre, utilisateur_id, modifie_le")
      .eq("id", projetId)
      .maybeSingle(),
  );
}

// Les doubles pages dans l'ordre du livre, avec les dimensions des photos posées :
// de quoi contrôler les cadres avant le rendu (controlerExport).
export async function lireDoublesPagesAControler(
  projetId: string,
): Promise<(DoublePageAControler & { role: string; position: number | null })[]> {
  const doublesPages = verifier(
    await supabase
      .from("double_page")
      .select(
        `id, role, position,
        emplacement (
          id, nature, x, y, largeur, hauteur,
          cadrage_x, cadrage_y, cadrage_zoom,
          photo (largeur_px, hauteur_px)
        )`,
      )
      .eq("projet_id", projetId)
      .order("role")
      .order("position")
      .order("indice", { referencedTable: "emplacement" }),
  );
  return (doublesPages ?? []).map((doublePage) => ({
    id: doublePage.id,
    role: doublePage.role,
    position: doublePage.position,
    emplacements: doublePage.emplacement,
  }));
}
```

- [ ] **Step 2: Écrire l'écran `Export.tsx`**

Créer `apps/web/src/ecrans/Export.tsx` :

```tsx
import { controlerExport } from "@bookopia/shared";
import { useEffect, useState } from "react";
import {
  data,
  type LoaderFunctionArgs,
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
} from "react-router";
import { z } from "zod";
import { ErreurNonAuthentifie, ErreurReseau } from "../api/client";
import {
  cheminPdf,
  ErreurPdfTropLourd,
  lireDoublesPagesAControler,
  lireExport,
  lireProjetPourExport,
  urlDuPdf,
} from "../api/exports";
import { libelleDoublePage } from "../composants/DoublePage";
import { dependancesExport } from "../export/brancher";
import { type Etape, exporter } from "../export/exporter";
import { sousSession } from "../session";
import { type EtatExport, VueExport } from "./VueExport";

const identifiantSchema = z.uuid();

// Un identifiant mal formé, un livre supprimé ou celui d'un autre : la même réponse, introuvable.
export async function chargerExport({ request, params }: LoaderFunctionArgs) {
  return sousSession(request, async () => {
    const identifiant = identifiantSchema.safeParse(params.id);
    const projet = identifiant.success
      ? await lireProjetPourExport(identifiant.data)
      : null;
    if (!projet) {
      throw data("Livre introuvable", { status: 404 });
    }
    const doublesPages = await lireDoublesPagesAControler(projet.id);
    const pdf = await lireExport(projet.id);
    return {
      projet: {
        id: projet.id,
        titre: projet.titre,
        utilisateur_id: projet.utilisateur_id,
      },
      controle: controlerExport(doublesPages),
      libelles: Object.fromEntries(
        doublesPages.map((doublePage) => [
          doublePage.id,
          libelleDoublePage(
            doublePage.role as Parameters<typeof libelleDoublePage>[0],
            doublePage.position,
          ),
        ]),
      ),
      urlDuPdf: pdf
        ? await urlDuPdf(
            cheminPdf(projet.utilisateur_id, projet.id, pdf.cle_stockage),
            projet.titre,
          )
        : null,
      // « Exporté et à jour » se calcule : le PDF date d'après la dernière modification du livre.
      aJour: pdf
        ? Date.parse(pdf.cree_le) > Date.parse(projet.modifie_le)
        : false,
    };
  });
}

type Phase =
  | { nom: "repos" }
  | { nom: "export"; etape: Etape | null }
  | { nom: "echec"; message: string };

function messageEchec(probleme: unknown): string {
  if (probleme instanceof ErreurPdfTropLourd) {
    return "Le PDF dépasse 50 Mo et n'a pas pu être enregistré.";
  }
  if (probleme instanceof ErreurReseau) {
    return "Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.";
  }
  return "L'export a échoué. Réessayez dans un instant.";
}

// E9 : le PDF se compose dans le navigateur, l'écran suit les étapes d'exporter().
export function Export() {
  const { projet, controle, libelles, urlDuPdf, aJour } =
    useLoaderData<typeof chargerExport>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { revalidate } = useRevalidator();
  const [phase, setPhase] = useState<Phase>({ nom: "repos" });

  const enExport = phase.nom === "export";

  // Fermer l'onglet en plein export perd le rendu ; l'ancien PDF, lui, reste disponible.
  useEffect(() => {
    if (!enExport) return;
    const retenir = (evenement: BeforeUnloadEvent) => {
      evenement.preventDefault();
    };
    window.addEventListener("beforeunload", retenir);
    return () => window.removeEventListener("beforeunload", retenir);
  }, [enExport]);

  const echouer = (probleme: unknown) => {
    if (probleme instanceof ErreurNonAuthentifie) {
      void navigate(`/connexion?retour=${encodeURIComponent(pathname)}`);
      return;
    }
    setPhase({ nom: "echec", message: messageEchec(probleme) });
  };

  const lancerExport = async () => {
    setPhase({ nom: "export", etape: null });
    try {
      await exporter(dependancesExport(projet), {
        onEtape: (etape) => setPhase({ nom: "export", etape }),
      });
      setPhase({ nom: "repos" });
      // Le loader relit les contrôles et signe l'adresse du nouveau PDF.
      void revalidate();
    } catch (probleme) {
      echouer(probleme);
    }
  };

  const etat: EtatExport =
    phase.nom === "export"
      ? "en_cours"
      : phase.nom === "echec"
        ? "echec"
        : urlDuPdf
          ? "disponible"
          : "demande";

  return (
    <VueExport
      projet={projet}
      controle={controle}
      libelles={libelles}
      etat={etat}
      etape={phase.nom === "export" ? phase.etape : null}
      message={phase.nom === "echec" ? phase.message : null}
      urlDuPdf={urlDuPdf}
      aJour={aJour}
      surExporter={() => void lancerExport()}
    />
  );
}
```

Note : `libelleDoublePage` attend `DoublePageDuLivre["role"]`. Si `lireDoublesPagesAControler` renvoie `role` typé par l'énuméré de la base, remplacer le `as Parameters<…>[0]` ci-dessus par le type exact (`DoublePageDuLivre["role"]` importé de `../api/doublesPages`) et typer `role` dans le retour de `lireDoublesPagesAControler` avec le même type, pour supprimer le cast.

- [ ] **Step 3: Ajouter la route**

Dans `apps/web/src/routeur.tsx`, ajouter parmi les imports d'écrans :

```tsx
import { chargerExport, Export } from "./ecrans/Export";
```

puis, dans le tableau `children` de la route sans chemin qui porte `ErrorBoundary: ErreurChargement`, juste après l'objet de la route `id: "livre"` (celui qui se termine par `children: [{ path: "import", … }]`), ajouter :

```tsx
              // E9 : écran à part entière, pas une surcouche de l'éditeur.
              {
                path: "/livre/:id/export",
                loader: chargerExport,
                Component: Export,
              },
```

- [ ] **Step 4: Remplacer le bloc provisoire dans `LivreEnCours`**

Dans `apps/web/src/ecrans/LivreEnCours.tsx` :

1. Supprimer la ligne `import { cheminPdf, lireExport, urlDuPdf } from "../api/exports";`.
2. Supprimer la ligne `import { ExportDuLivre } from "./ExportDuLivre";`.
3. Dans `chargerLivreEnCours`, supprimer la ligne `const pdf = await lireExport(projet.id);` et la propriété `urlDuPdf: pdf ? await urlDuPdf(...) : null,` du retour (les cinq lignes `urlDuPdf: pdf` à `: null,`).
4. Dans `LivreEnCours`, retirer `urlDuPdf,` de la déstructuration de `useLoaderData`.
5. Remplacer

```tsx
      {photos.length > 0 && (
        <ExportDuLivre projet={projet} urlDuPdf={urlDuPdf} />
      )}
```

par

```tsx
      {photos.length > 0 && (
        <Link to="export" className={styles.lienExport}>
          Exporter le livre
        </Link>
      )}
```

6. Mettre à jour le commentaire au-dessus de `LivreEnCours` : « E7 : l'éditeur, l'import (E5) qui s'ouvre par-dessus à sa propre adresse, et le lien vers l'export (E9). »

Dans `apps/web/src/ecrans/LivreEnCours.module.css`, remplacer les quatre règles `.export`, `.actionsExport`, `.telechargement` et `.etat` par :

```css
.lienExport {
  display: inline-block;
  margin-top: var(--espace-6);
  color: var(--couleur-encre);
  font-weight: 700;
}
```

- [ ] **Step 5: Supprimer le bloc provisoire**

```bash
git rm apps/web/src/ecrans/ExportDuLivre.tsx
```

- [ ] **Step 6: Vérifier**

Run: `npm run lint && npm run typecheck && npm test`
Expected: aucune erreur, tous les tests passent. En cas d'erreur de type sur `role`, appliquer la correction décrite à la fin de l'étape 2.

- [ ] **Step 7: Vérifier à la main dans le navigateur**

Démarrer la base (`supabase start`) et le front (`npm run dev -w apps/web`), se connecter, ouvrir un livre composé :
- le lien « Exporter le livre » mène à `/livre/<id>/export` ;
- l'écran liste les cadres vides de la couverture et de la 4e, chacun avec un lien qui ouvre l'éditeur sur la bonne double page ;
- « Exporter le PDF » montre la progression, puis « PDF à jour » et « Télécharger le PDF » ;
- recharger la page garde l'écran ; une adresse `/livre/pas-un-uuid/export` affiche « introuvable ».

- [ ] **Step 8: Commiter**

```bash
git add apps/web/src/api/exports.ts apps/web/src/ecrans/Export.tsx apps/web/src/routeur.tsx apps/web/src/ecrans/LivreEnCours.tsx apps/web/src/ecrans/LivreEnCours.module.css
git commit -m "ajoute la route de l'écran d'export et retire le bloc provisoire de l'éditeur

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(`git rm` a déjà indexé la suppression de `ExportDuLivre.tsx`.)

---

### Task 4: Parcours e2e

**Files:**
- Modify: `e2e/premier-pdf.spec.ts`

**Interfaces:**
- Consumes: le lien « Exporter le livre » (tâche 3), les titres « Avant l'export », « Cadres photo vides », le bouton « Exporter le PDF », le lien « Télécharger le PDF ».
- Produces: rien.

- [ ] **Step 1: Mettre à jour le parcours**

Dans `e2e/premier-pdf.spec.ts`, remplacer les deux lignes

```ts
  await page.getByRole("button", { name: "Exporter le PDF" }).click();
  const lien = page.getByRole("link", { name: "Télécharger le PDF" });
```

par :

```ts
  await page.getByRole("link", { name: "Exporter le livre" }).click();
  await expect(page).toHaveURL(/\/livre\/[^/]+\/export$/);

  // Les cadres photo de la couverture et de la 4e sont vides : ils sont listés, sans bloquer.
  await expect(
    page.getByRole("heading", { name: "Cadres photo vides" }),
  ).toBeVisible();
  const vide = page.getByRole("link", { name: "Couverture" });
  await expect(vide).toBeVisible();
  await expect(page.getByRole("link", { name: "Quatrième de couverture" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exporter le PDF" })).toBeEnabled();

  // Le lien ouvre l'éditeur sur la double page concernée, puis on revient.
  await vide.click();
  await expect(page).toHaveURL(/\/livre\/[^/]+\?page=/);
  await page.goBack();

  await page.getByRole("button", { name: "Exporter le PDF" }).click();
  await expect(page.getByText("PDF à jour.")).toBeVisible();
  const lien = page.getByRole("link", { name: "Télécharger le PDF" });
```

- [ ] **Step 2: Formater**

Run: `npx prettier --write e2e/premier-pdf.spec.ts`

- [ ] **Step 3: Lancer le parcours**

Prérequis : `supabase start` et `supabase db reset`.

Run: `npm run e2e -- e2e/premier-pdf.spec.ts`
Expected: PASS. Si le lien « Couverture » est ambigu avec un autre lien de l'écran, le restreindre à la liste « Cadres photo vides » (`page.getByRole("list").getByRole("link", { name: "Couverture" })`) sans changer l'intention.

- [ ] **Step 4: Vérifier et commiter**

Run: `npm run lint && npm run typecheck && npm test`
Expected: aucune erreur.

```bash
git add e2e/premier-pdf.spec.ts
git commit -m "étend le parcours de premier PDF à l'écran d'export et à ses contrôles

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

**Couverture du spec**
- Contrôles (liste, ordre, texte ignoré, seuil, fond perdu, zoom) → tâche 1.
- Cinq états, messages, ancien PDF conservé en cours et en échec, « à jour » → tâche 2 (vue) et tâche 3 (dérivation de l'état et de `aJour`).
- Adresse `/livre/:id/export`, loader, 404 → tâche 3.
- Liens `?page=<id>` → tâches 2 et 3, vérifiés en tâche 4.
- Bloc provisoire retiré, lien « Exporter le livre » → tâche 3.
- `beforeunload`, session expirée, messages d'échec conservés → tâche 3.
- Tests unitaires, composants, e2e → tâches 1, 2, 4.
- Hors périmètre respecté : pas de liste 150 à 300 DPI, pas de sélection du cadre, pas de suivi après rechargement, étape 51 laissée de côté.

**Cohérence des types** : `ControleExport` (tâche 1) est consommé tel quel par `VueExport` (tâche 2) et produit par le loader (tâche 3). `EtatExport` et les propriétés de `VueExport` ont les mêmes noms dans la tâche 2 et le conteneur de la tâche 3. Le seul point de friction est le type de `role` dans `libelleDoublePage`, traité par la note de l'étape 2 de la tâche 3.

**Écart à signaler au relecteur** : le spec dit que le loader lit « les emplacements, les photos et la ligne `export` » ; le plan ajoute aussi `projet.modifie_le`, nécessaire à « à jour ». Aucun changement de comportement.
