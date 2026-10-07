import type { KeyboardEvent } from "react";

// Flèches entre les cartes d'une surcouche de choix, en plus de Tab ; une carte désactivée
// (le choix actuel) est sautée.
export function naviguerEntreCartes(evenement: KeyboardEvent<HTMLElement>) {
  const pas =
    evenement.key === "ArrowRight" || evenement.key === "ArrowDown"
      ? 1
      : evenement.key === "ArrowLeft" || evenement.key === "ArrowUp"
        ? -1
        : 0;
  if (pas === 0) return;
  const boutons = [
    ...evenement.currentTarget.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    ),
  ];
  const rang = boutons.indexOf(document.activeElement as HTMLButtonElement);
  if (rang === -1) return;
  evenement.preventDefault();
  boutons[(rang + pas + boutons.length) % boutons.length]?.focus();
}
