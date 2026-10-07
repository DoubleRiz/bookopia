import type { Tables } from "@bookopia/shared";
import styles from "./CatalogueModeles.module.css";

type ModeleAffiche = Pick<
  Tables<"modele_livre">,
  "id" | "nom" | "nombre_doubles_pages_depart"
>;

// Tant que les visuels d'aperçu n'existent pas, chaque modèle prend une teinte pastel, à tour de rôle.
const TEINTES = [
  "var(--couleur-ciel)",
  "var(--couleur-rose)",
  "var(--couleur-menthe)",
  "var(--couleur-beurre)",
];

// Choix d'un modèle, sans rien savoir de la création : le même catalogue servira sur la vitrine (E0).
export function CatalogueModeles({
  modeles,
  name,
  selection,
  onChoisir,
}: {
  modeles: ModeleAffiche[];
  name: string;
  selection: string;
  onChoisir: (id: string) => void;
}) {
  return (
    <fieldset className={styles.catalogue}>
      <legend className={styles.legende}>Modèle</legend>
      <ul className={styles.grille}>
        {modeles.map((modele, rang) => (
          <li key={modele.id}>
            <label className={styles.tuile}>
              <input
                type="radio"
                name={name}
                value={modele.id}
                checked={modele.id === selection}
                onChange={() => onChoisir(modele.id)}
                className={styles.choix}
              />
              <span
                className={styles.apercu}
                style={{ background: TEINTES[rang % TEINTES.length] }}
                aria-hidden="true"
              >
                <span className={styles.coche}>✓</span>
              </span>
              <span className={styles.nom}>{modele.nom}</span>
              <span className={styles.pages}>
                {modele.nombre_doubles_pages_depart} doubles pages
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
