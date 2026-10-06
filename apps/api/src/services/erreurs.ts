// « introuvable » couvre aussi ce qui appartient à un autre utilisateur :
// répondre « interdit » confirmerait que la ressource existe.
// « interdit » est réservé au refus d'une URL signée : il est décidé avant tout accès au fichier,
// et ne révèle donc rien de son existence.
export type CodeErreurMetier =
  "introuvable" | "invalide" | "conflit" | "non_authentifie" | "interdit";

export class ErreurMetier extends Error {
  constructor(
    readonly code: CodeErreurMetier,
    message: string,
  ) {
    super(message);
    this.name = "ErreurMetier";
  }
}
