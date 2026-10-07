import { type InputHTMLAttributes, useId } from "react";
import styles from "./Champ.module.css";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  libelle: string;
  name: string;
  erreurs?: string[];
};

export function Champ({ libelle, erreurs, ...props }: Props) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const enErreur = erreurs !== undefined && erreurs.length > 0;

  return (
    <div className={styles.champ}>
      <label className={styles.libelle} htmlFor={id}>
        {libelle}
      </label>
      <input
        id={id}
        className={styles.saisie}
        aria-invalid={enErreur || undefined}
        aria-describedby={enErreur ? idErreur : undefined}
        {...props}
      />
      {enErreur && (
        <span id={idErreur} className={styles.erreur}>
          {erreurs.join(" ")}
        </span>
      )}
    </div>
  );
}
