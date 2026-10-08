import {
  ALIGNEMENTS_BLOC,
  CATALOGUE_POLICES,
  FAMILLES_POLICES,
  policeDuStyle,
  type StyleTexte,
  TAILLE_MAX_PT,
  TAILLE_MIN_PT,
  type Theme,
} from "@bookopia/shared";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import { familleCss, preparerPolices } from "../polices";
import styles from "./BarreMiseEnForme.module.css";
import type { Alignement, Famille } from "./extensionsTexte";

// Les contrôles gardent le focus dans le texte : un clic ne doit pas fermer la saisie.
const garderLeFocus = (evenement: MouseEvent) => evenement.preventDefault();

function Outil({
  libelle,
  actif = false,
  desactive = false,
  surClic,
  children,
}: {
  libelle: string;
  actif?: boolean;
  desactive?: boolean;
  surClic: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={[styles.outil, actif && styles.actif]
        .filter(Boolean)
        .join(" ")}
      aria-label={libelle}
      title={libelle}
      aria-pressed={actif}
      disabled={desactive}
      onMouseDown={garderLeFocus}
      onClick={surClic}
    >
      {children}
    </button>
  );
}

// Le catalogue, chaque nom écrit dans sa police. Les polices ne se chargent qu'à l'ouverture.
function ChoixPolice({
  famille,
  surChoix,
}: {
  famille: Famille;
  surChoix: (famille: Famille) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [pretes, setPretes] = useState(false);
  const identifiant = useId();

  useEffect(() => {
    if (!ouvert || pretes) return;
    let annule = false;
    preparerPolices(
      FAMILLES_POLICES.map((nom) => CATALOGUE_POLICES[nom].regulier),
    ).then(
      () => !annule && setPretes(true),
      () => {},
    );
    return () => {
      annule = true;
    };
  }, [ouvert, pretes]);

  function clavier(evenement: KeyboardEvent) {
    if (evenement.key === "Escape" && ouvert) {
      evenement.stopPropagation();
      setOuvert(false);
    }
  }

  return (
    <div className={styles.police} onKeyDown={clavier}>
      <button
        type="button"
        className={[styles.outil, styles.nomPolice].join(" ")}
        aria-label={`Police : ${famille}`}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={identifiant}
        onMouseDown={garderLeFocus}
        onClick={() => setOuvert(!ouvert)}
      >
        {famille}
      </button>
      {ouvert && (
        <ul
          id={identifiant}
          className={styles.liste}
          role="listbox"
          aria-label="Polices"
        >
          {FAMILLES_POLICES.map((nom) => (
            <li key={nom} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={nom === famille}
                className={styles.option}
                style={{
                  fontFamily: pretes
                    ? familleCss(CATALOGUE_POLICES[nom].regulier)
                    : undefined,
                }}
                onMouseDown={garderLeFocus}
                onClick={() => {
                  setOuvert(false);
                  surChoix(nom);
                }}
              >
                {nom}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChampTaille({
  taille,
  surChoix,
}: {
  taille: number;
  surChoix: (taille: number) => void;
}) {
  const [saisie, setSaisie] = useState<string | null>(null);
  const borner = (valeur: number) =>
    Math.min(TAILLE_MAX_PT, Math.max(TAILLE_MIN_PT, Math.round(valeur)));

  function valider() {
    const valeur = Number(saisie);
    setSaisie(null);
    if (saisie !== null && saisie !== "" && Number.isFinite(valeur)) {
      surChoix(borner(valeur));
    }
  }

  return (
    <div className={styles.taille}>
      <Outil
        libelle="Réduire la taille"
        desactive={taille <= TAILLE_MIN_PT}
        surClic={() => surChoix(borner(taille - 1))}
      >
        −
      </Outil>
      <input
        className={styles.champTaille}
        type="text"
        inputMode="numeric"
        aria-label="Taille en points"
        value={saisie ?? String(taille)}
        onFocus={(evenement) => evenement.currentTarget.select()}
        onChange={(evenement) => setSaisie(evenement.target.value)}
        onBlur={valider}
        onKeyDown={(evenement) => {
          if (evenement.key === "Enter") {
            evenement.preventDefault();
            valider();
          }
        }}
      />
      <Outil
        libelle="Augmenter la taille"
        desactive={taille >= TAILLE_MAX_PT}
        surClic={() => surChoix(borner(taille + 1))}
      >
        +
      </Outil>
    </div>
  );
}

const ICONES_ALIGNEMENT: Record<Alignement, string> = {
  gauche: "M3 6h18M3 12h12M3 18h16",
  centre: "M3 6h18M6 12h12M4 18h16",
  droite: "M3 6h18M9 12h12M5 18h16",
};

const LIBELLES_ALIGNEMENT: Record<Alignement, string> = {
  gauche: "Aligner à gauche",
  centre: "Centrer",
  droite: "Aligner à droite",
};

function Icone({ trace }: { trace: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d={trace} />
    </svg>
  );
}

// La barre de mise en forme du cadre texte sélectionné ou en cours de saisie. Elle lit l'éditeur et lui écrit : le
// document du livre n'en dépend pas.
export function BarreMiseEnForme({
  editor,
  theme,
  styleTexte,
  toutLeTexte,
}: {
  editor: Editor;
  theme: Theme;
  styleTexte: StyleTexte;
  // Cadre sélectionné sans saisie : chaque réglage s'applique à tout le texte.
  toutLeTexte: boolean;
}) {
  const base = policeDuStyle(theme.typographie, styleTexte);
  const etat = useEditorState({
    editor,
    selector: ({ editor: courant }) => {
      const reglage = courant.getAttributes("reglage") as {
        police?: Famille | null;
        taille_pt?: number | null;
        couleur?: string | null;
      };
      const paragraphe = courant.getAttributes("paragraph") as {
        alignement?: Alignement | null;
      };
      return {
        police: reglage.police ?? null,
        taille: reglage.taille_pt ?? null,
        couleur: reglage.couleur ?? null,
        gras: courant.isActive("bold"),
        italique: courant.isActive("italic"),
        souligne: courant.isActive("underline"),
        liste: courant.isActive("bulletList"),
        alignement: paragraphe.alignement ?? null,
      };
    },
  });

  const famille = etat.police ?? base.police;
  const taille = etat.taille ?? base.taille_pt;
  const variantes = CATALOGUE_POLICES[famille];
  const couleur = etat.couleur ?? theme.palette.texte;
  const raccourcis = [
    { nom: "Couleur du texte du thème", valeur: theme.palette.texte },
    { nom: "Couleur du fond du thème", valeur: theme.palette.fond },
  ];

  const chaine = () =>
    toutLeTexte ? editor.chain().selectAll() : editor.chain().focus();

  async function choisirPolice(nom: Famille) {
    try {
      await preparerPolices(
        Object.values(CATALOGUE_POLICES[nom]).filter((cle) => cle !== null),
      );
    } catch {
      return;
    }
    const suivantes = CATALOGUE_POLICES[nom];
    let commande = chaine().reglerTexte({
      police: nom === base.police ? null : nom,
    });
    // Un gras ou un italique que la famille n'a pas est retiré : jamais de faux gras.
    if (!suivantes.gras && editor.isActive("bold")) {
      commande = commande.unsetBold();
    }
    if (!suivantes.italique && editor.isActive("italic")) {
      commande = commande.unsetItalic();
    }
    commande.run();
  }

  function revenirAuTheme() {
    chaine().unsetAllMarks().aligner(null).run();
  }

  return (
    <div
      className={styles.barre}
      role="toolbar"
      aria-label="Mise en forme du texte"
    >
      <ChoixPolice
        famille={famille}
        surChoix={(nom) => void choisirPolice(nom)}
      />
      <ChampTaille
        taille={taille}
        surChoix={(valeur) =>
          chaine()
            .reglerTexte({
              taille_pt: valeur === base.taille_pt ? null : valeur,
            })
            .run()
        }
      />
      <span className={styles.separateur} aria-hidden="true" />
      <Outil
        libelle="Gras"
        actif={etat.gras}
        desactive={!variantes.gras}
        surClic={() => chaine().toggleBold().run()}
      >
        <strong>G</strong>
      </Outil>
      <Outil
        libelle="Italique"
        actif={etat.italique}
        desactive={!variantes.italique}
        surClic={() => chaine().toggleItalic().run()}
      >
        <em>I</em>
      </Outil>
      <Outil
        libelle="Souligné"
        actif={etat.souligne}
        surClic={() => chaine().toggleUnderline().run()}
      >
        <span className={styles.souligne}>S</span>
      </Outil>
      <span className={styles.separateur} aria-hidden="true" />
      <div className={styles.couleurs} role="group" aria-label="Couleur">
        {raccourcis.map(({ nom, valeur }) => (
          <button
            key={nom}
            type="button"
            className={[styles.echantillon, couleur === valeur && styles.actif]
              .filter(Boolean)
              .join(" ")}
            style={{ background: valeur }}
            aria-label={nom}
            title={nom}
            aria-pressed={couleur === valeur}
            onMouseDown={garderLeFocus}
            onClick={() =>
              chaine()
                .reglerTexte({
                  couleur: valeur === theme.palette.texte ? null : valeur,
                })
                .run()
            }
          />
        ))}
        <input
          className={styles.selecteurCouleur}
          type="color"
          aria-label="Choisir une couleur"
          value={couleur.toLowerCase()}
          onChange={(evenement) =>
            chaine().reglerTexte({ couleur: evenement.target.value }).run()
          }
        />
      </div>
      <span className={styles.separateur} aria-hidden="true" />
      {ALIGNEMENTS_BLOC.map((alignement) => (
        <Outil
          key={alignement}
          libelle={LIBELLES_ALIGNEMENT[alignement]}
          actif={etat.alignement === alignement}
          desactive={etat.liste}
          surClic={() =>
            chaine()
              .aligner(etat.alignement === alignement ? null : alignement)
              .run()
          }
        >
          <Icone trace={ICONES_ALIGNEMENT[alignement]} />
        </Outil>
      ))}
      <Outil
        libelle="Liste à puces"
        actif={etat.liste}
        surClic={() => chaine().toggleBulletList().run()}
      >
        <Icone trace="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />
      </Outil>
      <Outil libelle="Revenir au thème" surClic={revenirAuTheme}>
        <Icone trace="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" />
      </Outil>
    </div>
  );
}
