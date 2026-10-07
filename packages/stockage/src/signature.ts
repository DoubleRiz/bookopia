import { createHmac, timingSafeEqual } from "node:crypto";

// Le saut de ligne sépare chemin et expiration : aucun chemin construit n'en contient,
// deux couples différents ne peuvent donc pas produire le même message.
export function signer(secret: string, chemin: string, expire: number) {
  return createHmac("sha256", secret)
    .update(`${chemin}\n${expire}`)
    .digest("base64url");
}

export function verifierSignature(
  secret: string,
  chemin: string,
  expire: number,
  signature: string,
  maintenantSecondes = Math.floor(Date.now() / 1000),
) {
  if (expire <= maintenantSecondes) {
    return false;
  }
  const attendue = Buffer.from(signer(secret, chemin, expire));
  const recue = Buffer.from(signature);
  // timingSafeEqual lève sur des longueurs différentes ; la longueur d'un HMAC n'est pas un secret.
  // La comparaison à temps constant empêche de deviner la signature octet par octet au chronomètre.
  return attendue.length === recue.length && timingSafeEqual(attendue, recue);
}
