import { reponseListeProjetsSchema } from "@bookopia/shared";
import { requete } from "./client";

export async function listerProjets() {
  const { projets } = await requete("/projets", {
    schema: reponseListeProjetsSchema,
  });
  return projets;
}
