import type { ShouldRevalidateFunctionArgs } from "react-router";

// Changer de double page courante ne touche que ?page= : l'état des doubles pages vit dans
// le réducteur de l'éditeur, relu après chaque geste de structure. Relancer les loaders
// (en-tête, photos, URLs signées, export, thèmes, polices) ferait attendre le réseau pour rien.
// Une action ou un revalidate() explicite (même adresse) rechargent toujours.
export function revaliderSaufPageCourante({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  if (formMethod || currentUrl.pathname !== nextUrl.pathname) {
    return defaultShouldRevalidate;
  }
  const avant = new URLSearchParams(currentUrl.searchParams);
  const apres = new URLSearchParams(nextUrl.searchParams);
  const pageChange = avant.get("page") !== apres.get("page");
  avant.delete("page");
  apres.delete("page");
  if (pageChange && avant.toString() === apres.toString()) return false;
  return defaultShouldRevalidate;
}
