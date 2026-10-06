// « introuvable » couvre aussi ce qui appartient à un autre utilisateur :
// répondre « interdit » confirmerait que la ressource existe.
export type CodeErreurMetier = "introuvable" | "invalide";

export class ErreurMetier extends Error {
  constructor(
    readonly code: CodeErreurMetier,
    message: string,
  ) {
    super(message);
    this.name = "ErreurMetier";
  }
}
