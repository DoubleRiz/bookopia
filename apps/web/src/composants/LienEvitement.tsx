import styles from "./LienEvitement.module.css";

// Premier élément focalisable de chaque écran (RGAA 12.7) : invisible tant qu'il n'a pas le focus,
// il évite au clavier de retraverser l'en-tête. Chaque écran a un seul <main>.
// Le href ne sert qu'à rendre le lien focalisable : le clic est intercepté, car une vraie ancre
// changerait l'adresse (le routeur la traiterait) et demanderait un id sur le <main> de chaque écran.
export function LienEvitement() {
  return (
    <a
      href="#contenu"
      className={styles.lien}
      onClick={(evenement) => {
        evenement.preventDefault();
        const contenu = document.querySelector<HTMLElement>("main");
        if (!contenu) return;
        // Sans tabindex, <main> n'est pas focalisable ; -1 le réserve au focus programmatique.
        contenu.tabIndex = -1;
        contenu.focus({ preventScroll: true });
      }}
    >
      Aller au contenu
    </a>
  );
}
