// Statut affiché dans l'en-tête de l'éditeur (design system §12).
export type StatutEnregistrement = "enregistre" | "enregistrement" | "echec";

// Un geste de l'éditeur : appliqué tout de suite à l'écran, écrit ensuite en base,
// rétabli si la base le refuse.
export type Ecriture = {
  appliquer: () => void;
  ecrire: () => Promise<void>;
  retablir: () => void;
};

// File d'écriture de l'éditeur. Une écriture à la fois, dans l'ordre des gestes : deux gestes
// rapides sur le même cadre arrivent en base dans l'ordre où le Créateur les a faits.
// Un échec ne bloque pas la suite ; le dernier geste refusé peut être rejoué.
export function creerFileEcritures({
  surStatut,
  surEchec,
}: {
  surStatut: (statut: StatutEnregistrement) => void;
  surEchec: (erreur: unknown) => void;
}) {
  let queue = Promise.resolve();
  let enAttente = 0;
  let refusee: Ecriture | null = null;

  const signaler = () =>
    surStatut(
      enAttente > 0 ? "enregistrement" : refusee ? "echec" : "enregistre",
    );

  function ajouter(ecriture: Ecriture) {
    ecriture.appliquer();
    enAttente += 1;
    signaler();
    queue = queue.then(async () => {
      try {
        await ecriture.ecrire();
      } catch (erreur) {
        ecriture.retablir();
        refusee = ecriture;
        surEchec(erreur);
      }
      enAttente -= 1;
      signaler();
    });
  }

  return {
    ajouter,
    // Rejoue le dernier geste refusé, depuis le début : il est réappliqué puis réécrit.
    reessayer() {
      const aRejouer = refusee;
      if (!aRejouer) return;
      refusee = null;
      ajouter(aRejouer);
    },
    // Résolue quand toutes les écritures en cours sont terminées, réussies ou non.
    terminer: () => queue,
  };
}

export type FileEcritures = ReturnType<typeof creerFileEcritures>;
