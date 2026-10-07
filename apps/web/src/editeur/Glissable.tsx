import type { DragEvent, HTMLAttributes, ReactNode } from "react";

// Un bouton qu'on peut aussi glisser. Chromium ne lance jamais dragstart depuis un <button> :
// c'est donc un élément ordinaire au rôle de bouton, qui reprend Entrée, Espace et le focus.
// actif : le bouton répond ; glissable : il se glisse (par défaut, quand il est actif).
export function Glissable({
  actif,
  glissable = actif,
  surActiver,
  surDebutGlisser,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "onClick" | "onKeyDown"> & {
  actif: boolean;
  glissable?: boolean;
  surActiver: () => void;
  surDebutGlisser: (evenement: DragEvent) => void;
  children: ReactNode;
}) {
  return (
    <div
      {...props}
      role="button"
      tabIndex={actif ? 0 : -1}
      aria-disabled={!actif || undefined}
      draggable={glissable}
      onDragStart={surDebutGlisser}
      onClick={() => actif && surActiver()}
      onKeyDown={(evenement) => {
        if (!actif) return;
        if (evenement.key === "Enter" || evenement.key === " ") {
          evenement.preventDefault();
          surActiver();
        }
      }}
    >
      {children}
    </div>
  );
}
