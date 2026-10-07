import { Link } from "react-router";
import styles from "./Logo.module.css";

// Le point corail est la touche de corail de l'en-tête.
export function Logo({ vers }: { vers: string }) {
  return (
    <Link to={vers} className={styles.logo}>
      Bookopia<span className={styles.point}>.</span>
    </Link>
  );
}
