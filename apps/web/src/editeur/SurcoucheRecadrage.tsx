import {
  type Cadrage,
  dpiEffectif,
  niveauResolution,
  prolongerParFondPerdu,
  zoneVisible,
} from "@bookopia/shared";
import {
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
  useRef,
  useState,
} from "react";
import type { EmplacementDuLivre } from "../api/doublesPages";
import { Bouton } from "../composants/Bouton";
import { Modale } from "../composants/Modale";
import styles from "./Editeur.module.css";

export const ZOOM_MAX = 4;

type Photo = { url?: string; largeur_px: number; hauteur_px: number };

// Le cadrage effectivement affiché : zoneVisible ramène le centre pour que la zone reste
// dans l'image. C'est ce centre-là qu'on enregistre, pour que l'écran et le PDF montrent la même zone.
function cadrageEffectif(
  photo: Photo,
  cadre: { largeur: number; hauteur: number },
  demande: Cadrage,
): Cadrage {
  const zoom = Math.min(Math.max(demande.zoom, 1), ZOOM_MAX);
  const zone = zoneVisible(photo, cadre, { ...demande, zoom });
  return {
    x: (zone.x + zone.largeur / 2) / photo.largeur_px,
    y: (zone.y + zone.hauteur / 2) / photo.hauteur_px,
    zoom,
  };
}

const LIBELLES_RESOLUTION = {
  bon: "Bonne qualité d'impression",
  moyen: "Qualité moyenne : un cadre plus petit serait préférable",
  faible: "Qualité insuffisante pour l'impression",
};

// Surcouche non adressée : elle ne survit pas à un rechargement, c'est voulu.
// La photo entière, et par-dessus la zone visible aux proportions du cadre. On la déplace
// à la souris ou aux flèches, on règle le zoom au curseur ou à la molette.
export function SurcoucheRecadrage({
  emplacement,
  photo,
  surValider,
  surFermer,
}: {
  emplacement: EmplacementDuLivre;
  photo: Photo;
  surValider: (cadrage: Cadrage) => void;
  surFermer: () => void;
}) {
  // Le cadre imprimé, fond perdu compris : c'est lui que placerPhoto remplit.
  const cadre = prolongerParFondPerdu(emplacement);
  const [cadrage, setCadrage] = useState<Cadrage>(() =>
    cadrageEffectif(photo, cadre, {
      x: emplacement.cadrage_x ?? 0.5,
      y: emplacement.cadrage_y ?? 0.5,
      zoom: emplacement.cadrage_zoom ?? 1,
    }),
  );
  const dessin = useRef<SVGSVGElement>(null);
  const glisser = useRef<{ x: number; y: number; depart: Cadrage } | null>(
    null,
  );

  const zone = zoneVisible(photo, cadre, cadrage);
  const dpi = dpiEffectif(
    {
      ...emplacement,
      cadrage_x: cadrage.x,
      cadrage_y: cadrage.y,
      cadrage_zoom: cadrage.zoom,
    },
    photo,
  );
  const niveau = niveauResolution(dpi);

  const regler = (demande: Cadrage) =>
    setCadrage(cadrageEffectif(photo, cadre, demande));

  // Pixels de l'écran → part de l'image : le dessin est l'image entière, mise à l'échelle.
  function deplacer(evenement: PointerEvent<SVGSVGElement>) {
    const debut = glisser.current;
    const boite = dessin.current?.getBoundingClientRect();
    if (!debut || !boite) return;
    regler({
      ...debut.depart,
      x: debut.depart.x + (evenement.clientX - debut.x) / boite.width,
      y: debut.depart.y + (evenement.clientY - debut.y) / boite.height,
    });
  }

  function molette(evenement: WheelEvent) {
    regler({
      ...cadrage,
      zoom: cadrage.zoom * Math.exp(-evenement.deltaY / 500),
    });
  }

  function clavier(evenement: KeyboardEvent) {
    const pas = evenement.shiftKey ? 0.1 : 0.01;
    const decalages: Record<string, [number, number]> = {
      ArrowLeft: [-pas, 0],
      ArrowRight: [pas, 0],
      ArrowUp: [0, -pas],
      ArrowDown: [0, pas],
    };
    const decalage = decalages[evenement.key];
    if (!decalage) return;
    evenement.preventDefault();
    regler({
      ...cadrage,
      x: cadrage.x + decalage[0],
      y: cadrage.y + decalage[1],
    });
  }

  return (
    <Modale titre="Recadrer la photo" onFermer={surFermer} large>
      <div className={styles.recadrage}>
        <svg
          ref={dessin}
          className={styles.dessinRecadrage}
          // Aux proportions exactes de la photo : un pixel déplacé à l'écran correspond
          // à la même part de l'image horizontalement et verticalement.
          style={{
            aspectRatio: `${photo.largeur_px} / ${photo.hauteur_px}`,
            width: `min(100%, calc(60vh * ${photo.largeur_px / photo.hauteur_px}))`,
          }}
          viewBox={`0 0 ${photo.largeur_px} ${photo.hauteur_px}`}
          tabIndex={0}
          role="application"
          aria-label="Zone visible : glisser ou utiliser les flèches pour la déplacer"
          onPointerDown={(evenement) => {
            evenement.currentTarget.setPointerCapture(evenement.pointerId);
            glisser.current = {
              x: evenement.clientX,
              y: evenement.clientY,
              depart: cadrage,
            };
          }}
          onPointerMove={deplacer}
          onPointerUp={() => {
            glisser.current = null;
          }}
          onWheel={molette}
          onKeyDown={clavier}
        >
          {photo.url && (
            <image
              href={photo.url}
              width={photo.largeur_px}
              height={photo.hauteur_px}
              preserveAspectRatio="none"
            />
          )}
          {/* Voile hors de la zone : un rectangle troué, règle evenodd. */}
          <path
            className={styles.voileRecadrage}
            fillRule="evenodd"
            d={`M0 0H${photo.largeur_px}V${photo.hauteur_px}H0Z M${zone.x} ${zone.y}h${zone.largeur}v${zone.hauteur}h${-zone.largeur}Z`}
          />
          <rect
            className={styles.zoneRecadrage}
            x={zone.x}
            y={zone.y}
            width={zone.largeur}
            height={zone.hauteur}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <label className={styles.zoom}>
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={ZOOM_MAX}
            step={0.01}
            value={cadrage.zoom}
            onChange={(evenement) =>
              regler({ ...cadrage, zoom: Number(evenement.target.value) })
            }
          />
        </label>
        <p className={[styles.resolution, styles[niveau]].join(" ")}>
          {LIBELLES_RESOLUTION[niveau]} · {Math.round(dpi)} DPI
        </p>
        <div className={styles.boutonsModale}>
          <Bouton variante="secondaire" onClick={surFermer}>
            Annuler
          </Bouton>
          <Bouton onClick={() => surValider(cadrage)}>Valider</Bouton>
        </div>
      </div>
    </Modale>
  );
}
