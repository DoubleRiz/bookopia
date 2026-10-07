import { useEffect, useState } from "react";
import type { DoublePageDuLivre } from "../api/doublesPages";
import type { ThemeDuCatalogue } from "../api/themes";
import { DoublePage, type PhotoAffichee } from "../composants/DoublePage";
import { Modale } from "../composants/Modale";
import { mesures, policesDuTheme, preparerPolices } from "../polices";
import { effetDuTheme, resumeDeLEffet } from "./choixTheme";
import styles from "./Editeur.module.css";
import { naviguerEntreCartes } from "./navigationCartes";

// Surcouche non adressée : habiller le livre d'un autre thème. Sans confirmation : rien n'est
// perdu, le geste se défait en choisissant l'ancien thème. Chaque carte dit ce que le thème
// fera aux textes déjà écrits.
export function SurcoucheThemes({
  themes,
  themeActuelId,
  apercu,
  doublesPages,
  photos,
  surChoisir,
  surFermer,
}: {
  themes: ThemeDuCatalogue[];
  themeActuelId: string;
  // La double page dessinée sur chaque carte : la page courante, sinon la couverture.
  apercu: DoublePageDuLivre;
  doublesPages: DoublePageDuLivre[];
  photos: Map<string, PhotoAffichee>;
  surChoisir: (themeId: string) => void;
  surFermer: () => void;
}) {
  // Les polices des autres thèmes ne se chargent qu'ici, à la première ouverture.
  const [etat, setEtat] = useState<"chargement" | "pret" | "echec">(
    "chargement",
  );
  useEffect(() => {
    let actif = true;
    preparerPolices(
      themes.flatMap((theme) => policesDuTheme(theme.typographie)),
    )
      .then(() => actif && setEtat("pret"))
      .catch(() => actif && setEtat("echec"));
    return () => {
      actif = false;
    };
  }, [themes]);

  return (
    <Modale titre="Changer le thème" onFermer={surFermer} large>
      {etat === "chargement" && <p>Chargement des thèmes…</p>}
      {etat === "echec" && (
        <p role="alert">
          Les polices des thèmes n'ont pas pu être chargées. Fermez puis
          réessayez.
        </p>
      )}
      {etat === "pret" && (
        <ul className={styles.gabarits} onKeyDown={naviguerEntreCartes}>
          {themes.map((theme) => {
            const actuel = theme.id === themeActuelId;
            // Le thème actuel ne change rien : son effet est déjà sous les yeux.
            const effet = actuel
              ? ""
              : resumeDeLEffet(effetDuTheme(doublesPages, theme, mesures));
            return (
              <li key={theme.id}>
                <button
                  type="button"
                  className={styles.carteGabarit}
                  disabled={actuel}
                  aria-label={`${theme.nom}${actuel ? ", thème actuel" : ""}${effet ? `, ${effet}` : ""}`}
                  onClick={() => surChoisir(theme.id)}
                >
                  <span className={styles.apercuGabarit} aria-hidden="true">
                    <DoublePage
                      doublePage={apercu}
                      habillage={{ theme, mesures }}
                      photos={photos}
                    />
                  </span>
                  <span className={styles.nomGabarit} aria-hidden="true">
                    {theme.nom}
                    {actuel && (
                      <span className={styles.badgeActuel}>Actuel</span>
                    )}
                  </span>
                  {effet && (
                    <span className={styles.resumeGabarit} aria-hidden="true">
                      {effet}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modale>
  );
}
