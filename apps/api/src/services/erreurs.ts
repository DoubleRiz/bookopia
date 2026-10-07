import type { CodeErreur } from "@bookopia/shared";

// « introuvable » couvre aussi ce qui appartient à un autre utilisateur :
// répondre « interdit » confirmerait que la ressource existe.
export type CodeErreurMetier = Extract<
  CodeErreur,
  "introuvable" | "invalide" | "conflit" | "non_authentifie"
>;

export class ErreurMetier extends Error {
  constructor(
    readonly code: CodeErreurMetier,
    message: string,
  ) {
    super(message);
    this.name = "ErreurMetier";
  }
}
