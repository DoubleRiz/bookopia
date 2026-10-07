import { type InputHTMLAttributes, useId } from "react";
import styles from "./Champ.module.css";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  libelle: string;
  name: string;
  erreurs?: string[];
  aide?: string;
};

export function Champ({ libelle, erreurs, aide, ...props }: Props) {
  const id = useId();
  const idErreur = `${id}-erreur`;
  const idAide = `${id}-aide`;
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
        aria-describedby={
          [aide && idAide, enErreur && idErreur].filter(Boolean).join(" ") ||
          undefined
        }
        {...props}
      />
      {aide && (
        <span id={idAide} className={styles.aide}>
          {aide}
        </span>
      )}
      {enErreur && (
        <span id={idErreur} className={styles.erreur}>
          {erreurs.join(" ")}
        </span>
      )}
    </div>
  );
}
