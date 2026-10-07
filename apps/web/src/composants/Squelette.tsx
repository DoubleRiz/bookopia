import styles from "./Squelette.module.css";

// Reprend la forme exacte du contenu attendu : c'est l'appelant qui donne les dimensions.
export function Squelette({
  largeur,
  hauteur,
  rayon,
}: {
  largeur: string;
  hauteur: string;
  rayon?: string;
}) {
  return (
    <span
      className={styles.squelette}
      style={{ width: largeur, height: hauteur, borderRadius: rayon }}
      aria-hidden="true"
    />
  );
}
