import { LARGEUR_DOUBLE_PAGE_MM } from "@bookopia/shared";
import {
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type Cadre,
  chevaucheUnAutre,
  glisser,
  memeCadre,
  type Poignee,
  POIGNEES,
} from "../editeur/geometrieCadre";
import styles from "./DoublePage.module.css";

// Un glissement de moins de 3 pixels reste un clic.
const SEUIL_PX = 3;
const TAILLE_POIGNEE_PX = 10;

const CURSEURS: Record<Poignee, string> = {
  corps: "move",
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

// Combien de millimètres de la double page tient dans un pixel d'écran : les poignées gardent
// la même taille à l'écran quelle que soit l'échelle du dessin.
export function useMmParPixel(svg: RefObject<SVGSVGElement | null>): number {
  const [echelle, setEchelle] = useState(0.5);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const mesurer = () => {
      const { width } = element.getBoundingClientRect();
      if (width > 0) setEchelle(LARGEUR_DOUBLE_PAGE_MM / width);
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [svg]);
  return echelle;
}

export type OptionsGeste = {
  svg: RefObject<SVGSVGElement | null>;
  emplacementId: string;
  cadre: Cadre;
  autres: Cadre[];
  surProvisoire: (provisoire: { id: string; cadre: Cadre } | null) => void;
  surPlacer: (emplacementId: string, cadre: Cadre) => void;
};

// Les gestes d'un cadre texte sélectionné : le faire glisser, tirer une poignée. Le cadre suit le
// pointeur pendant le geste (accroché à la grille et aux autres cadres, borné par les marges), s'arrête
// au dernier état valide s'il en chevauchait un autre, et part en base au relâchement.
export function useGestesCadre(options: OptionsGeste) {
  const courantes = useRef(options);
  useEffect(() => {
    courantes.current = options;
  });
  const geste = useRef<{
    poignee: Poignee;
    depart: Cadre;
    x0: number;
    y0: number;
    valide: Cadre;
    deplace: boolean;
  } | null>(null);
  const clicAvale = useRef(false);

  const debuter = (poignee: Poignee) => (evenement: PointerEvent) => {
    if (evenement.button !== 0) return;
    evenement.stopPropagation();
    evenement.currentTarget.setPointerCapture(evenement.pointerId);
    const { cadre } = courantes.current;
    geste.current = {
      poignee,
      depart: cadre,
      x0: evenement.clientX,
      y0: evenement.clientY,
      valide: cadre,
      deplace: false,
    };
  };

  function deplacer(evenement: PointerEvent) {
    const en = geste.current;
    const svg = courantes.current.svg.current;
    if (!en || !svg) return;
    const dxPx = evenement.clientX - en.x0;
    const dyPx = evenement.clientY - en.y0;
    if (!en.deplace && Math.hypot(dxPx, dyPx) < SEUIL_PX) return;
    en.deplace = true;
    const { width } = svg.getBoundingClientRect();
    if (width <= 0) return;
    const mmParPixel = LARGEUR_DOUBLE_PAGE_MM / width;
    const { autres, emplacementId, surProvisoire } = courantes.current;
    const candidat = glisser(
      en.depart,
      en.poignee,
      dxPx * mmParPixel,
      dyPx * mmParPixel,
      autres,
    );
    if (chevaucheUnAutre(candidat, autres)) return;
    en.valide = candidat;
    surProvisoire({ id: emplacementId, cadre: candidat });
  }

  function terminer(evenement: PointerEvent, annule: boolean) {
    const en = geste.current;
    geste.current = null;
    if (!en) return;
    if (evenement.currentTarget.hasPointerCapture(evenement.pointerId)) {
      evenement.currentTarget.releasePointerCapture(evenement.pointerId);
    }
    const { emplacementId, surProvisoire, surPlacer } = courantes.current;
    if (en.deplace) {
      // Le clic qui suit un glissement n'ouvre pas la saisie.
      clicAvale.current = true;
      window.setTimeout(() => (clicAvale.current = false), 0);
      if (!annule && !memeCadre(en.valide, en.depart)) {
        surPlacer(emplacementId, en.valide);
      }
    }
    surProvisoire(null);
  }

  return {
    // Les écouteurs d'un élément qui déclenche le geste `poignee`.
    surElement: (poignee: Poignee) => ({
      onPointerDown: debuter(poignee),
      onPointerMove: deplacer,
      onPointerUp: (evenement: PointerEvent) => terminer(evenement, false),
      onPointerCancel: (evenement: PointerEvent) => terminer(evenement, true),
    }),
    // Vrai une fois, juste après un glissement : le clic qui le suit doit être ignoré.
    avalerClic: () => {
      const avale = clicAvale.current;
      clicAvale.current = false;
      return avale;
    },
  };
}

// Les 8 poignées d'un cadre texte sélectionné.
export function Poignees({
  cadre,
  mmParPixel,
  ecouteurs,
}: {
  cadre: Cadre;
  mmParPixel: number;
  ecouteurs: (poignee: Poignee) => object;
}) {
  const taille = TAILLE_POIGNEE_PX * mmParPixel;
  const gauche = cadre.x;
  const milieuX = cadre.x + cadre.largeur / 2;
  const droite = cadre.x + cadre.largeur;
  const haut = cadre.y;
  const milieuY = cadre.y + cadre.hauteur / 2;
  const bas = cadre.y + cadre.hauteur;
  const centres: Record<(typeof POIGNEES)[number], [number, number]> = {
    nw: [gauche, haut],
    n: [milieuX, haut],
    ne: [droite, haut],
    e: [droite, milieuY],
    se: [droite, bas],
    s: [milieuX, bas],
    sw: [gauche, bas],
    w: [gauche, milieuY],
  };
  return (
    <>
      {POIGNEES.map((poignee) => (
        <rect
          key={poignee}
          className={styles.poignee}
          data-poignee={poignee}
          x={centres[poignee][0] - taille / 2}
          y={centres[poignee][1] - taille / 2}
          width={taille}
          height={taille}
          style={{ cursor: CURSEURS[poignee] }}
          {...ecouteurs(poignee)}
        />
      ))}
    </>
  );
}
