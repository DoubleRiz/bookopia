import {
  disposerTexte,
  HAUTEUR_DOUBLE_PAGE_MM,
  INTERLIGNE,
  LARGEUR_DOUBLE_PAGE_MM,
  type Mesures,
  type StyleTexte,
  type Theme,
} from "@bookopia/shared";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { EmplacementDuLivre } from "../api/doublesPages";
import { familleCss } from "../polices";
import styles from "./Editeur.module.css";

// Le plafond de la base (contrainte emplacement_plafond_texte).
export const LONGUEUR_MAX_TEXTE = 400;

const ALIGNEMENTS = { debut: "left", milieu: "center", fin: "right" } as const;

const enPourcentage = (mm: number, total: number) => `${(mm / total) * 100}%`;

// La zone de texte posée sur un cadre, à la police et à l'échelle du thème. Elle refuse ce qui
// ferait déborder le cadre : la mise en lignes est celle du PDF, la frappe ne peut pas la dépasser.
// Un texte déjà trop long (après un changement de thème) peut toujours être raccourci.
export function SaisieTexte({
  emplacement,
  theme,
  mesures,
  surChangement,
  surFin,
}: {
  emplacement: EmplacementDuLivre & { style_texte: StyleTexte };
  theme: Theme;
  mesures: Mesures;
  surChangement: (contenu: string) => void;
  surFin: () => void;
}) {
  const valeur = emplacement.contenu_texte ?? "";
  const [annonce, setAnnonce] = useState("");
  const zone = useRef<HTMLTextAreaElement>(null);
  // Position du curseur après un collage raccourci : React réécrit la valeur, le curseur suit.
  const curseur = useRef<number | null>(null);

  useEffect(() => {
    const element = zone.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, []);

  useLayoutEffect(() => {
    if (curseur.current === null || !zone.current) return;
    zone.current.setSelectionRange(curseur.current, curseur.current);
    curseur.current = null;
  });

  const disposer = (texte: string) =>
    disposerTexte(
      { ...emplacement, contenu_texte: texte },
      theme.typographie,
      mesures,
    );
  const dispose = disposer(valeur);

  function changer(evenement: ChangeEvent<HTMLTextAreaElement>) {
    const suivant = evenement.target.value;
    if (suivant.length > valeur.length && disposer(suivant).deborde) {
      setAnnonce("Le cadre est plein");
      return;
    }
    // Une espace en fin de ligne tient toujours : seul un texte raccourci fait taire l'annonce.
    if (suivant.length < valeur.length) setAnnonce("");
    surChangement(suivant);
  }

  // Seul le début du collage qui tient est inséré, à la place de la sélection.
  function coller(evenement: ClipboardEvent<HTMLTextAreaElement>) {
    evenement.preventDefault();
    const colle = evenement.clipboardData.getData("text/plain");
    const { selectionStart, selectionEnd } = evenement.currentTarget;
    const avant = valeur.slice(0, selectionStart);
    const apres = valeur.slice(selectionEnd);
    const tient = (longueur: number) =>
      avant.length + longueur + apres.length <= LONGUEUR_MAX_TEXTE &&
      !disposer(avant + colle.slice(0, longueur) + apres).deborde;
    let bas = 0;
    let haut = colle.length;
    while (bas < haut) {
      const milieu = Math.ceil((bas + haut) / 2);
      if (tient(milieu)) bas = milieu;
      else haut = milieu - 1;
    }
    setAnnonce(bas < colle.length ? "Le texte collé a été raccourci" : "");
    curseur.current = avant.length + bas;
    surChangement(avant + colle.slice(0, bas) + apres);
  }

  function clavier(evenement: KeyboardEvent<HTMLTextAreaElement>) {
    if (evenement.key === "Escape") {
      evenement.preventDefault();
      evenement.stopPropagation();
      surFin();
    }
  }

  // En ancrage bas, la zone n'a que la hauteur de ses lignes et repose sur le bas du cadre,
  // là où le dessin les posera.
  const hauteur =
    theme.typographie.ancrage === "bas"
      ? Math.min(
          Math.max(1, dispose.lignes.length) * dispose.interligne_mm,
          emplacement.hauteur,
        )
      : emplacement.hauteur;
  const haut = emplacement.y + emplacement.hauteur - hauteur;

  return (
    <>
      <textarea
        ref={zone}
        className={styles.saisieTexte}
        aria-label={`${emplacement.style_texte === "legende" ? "Légende" : "Titre"} ${emplacement.indice + 1}`}
        value={valeur}
        maxLength={LONGUEUR_MAX_TEXTE}
        spellCheck
        style={{
          left: enPourcentage(emplacement.x, LARGEUR_DOUBLE_PAGE_MM),
          top: enPourcentage(haut, HAUTEUR_DOUBLE_PAGE_MM),
          width: enPourcentage(emplacement.largeur, LARGEUR_DOUBLE_PAGE_MM),
          height: enPourcentage(hauteur, HAUTEUR_DOUBLE_PAGE_MM),
          fontFamily: familleCss(dispose.police),
          // Des millimètres du dessin en largeur du conteneur : la zone suit l'échelle de la double page.
          fontSize: `${(dispose.taille_mm / LARGEUR_DOUBLE_PAGE_MM) * 100}cqw`,
          lineHeight: INTERLIGNE,
          textAlign: ALIGNEMENTS[dispose.ancre],
          color: theme.palette.texte,
        }}
        onChange={changer}
        onPaste={coller}
        onKeyDown={clavier}
        onBlur={surFin}
      />
      <span
        className={styles.annonceSaisie}
        // Pas de rôle status : l'éditeur en a déjà un, le statut d'enregistrement.
        aria-live="polite"
        style={{
          left: enPourcentage(emplacement.x, LARGEUR_DOUBLE_PAGE_MM),
          top: enPourcentage(
            emplacement.y + emplacement.hauteur,
            HAUTEUR_DOUBLE_PAGE_MM,
          ),
        }}
      >
        {annonce}
      </span>
    </>
  );
}
