-- Contraintes que Prisma ne sait pas exprimer. Écrites à la main : ne pas régénérer.
-- Justifications : docs/modele-donnees.md, « Contraintes hors schéma Prisma ».

-- Seules les doubles pages intérieures sont ordonnées ; couverture et 4e n'ont pas de rang.
ALTER TABLE "doublePage"
  ADD CONSTRAINT "doublePage_position_selon_role"
  CHECK (("position" IS NULL) = ("role" <> 'interieur'));

-- Une seule couverture et une seule 4e par projet. Les intérieures ne sont pas concernées.
CREATE UNIQUE INDEX "doublePage_projetId_role_hors_interieur_key"
  ON "doublePage" ("projetId", "role")
  WHERE "role" <> 'interieur';

-- Une table unique porte deux natures : les champs de l'autre nature doivent rester vides.
-- Pour une photo, les trois valeurs du cadrage vont ensemble, et une photo posée en exige un.
-- Un emplacement vide peut garder un ancien cadrage : le SET NULL qui suit la suppression
-- d'une photo ne remet à vide que photoId. Ce résidu est écrasé à la pose suivante.
ALTER TABLE "emplacement"
  ADD CONSTRAINT "emplacement_coherence_nature"
  CHECK (
    CASE "nature"
      WHEN 'texte' THEN
        "photoId" IS NULL
        AND "cadrageX" IS NULL AND "cadrageY" IS NULL AND "cadrageZoom" IS NULL
      WHEN 'photo' THEN
        "contenuTexte" IS NULL
        AND ("cadrageX" IS NULL) = ("cadrageY" IS NULL)
        AND ("cadrageX" IS NULL) = ("cadrageZoom" IS NULL)
        AND ("photoId" IS NULL OR "cadrageX" IS NOT NULL)
    END
  );

-- Cadrage normalisé : indépendant de la taille du cadre et de la résolution de la photo.
ALTER TABLE "emplacement"
  ADD CONSTRAINT "emplacement_bornes_cadrage"
  CHECK (
    "cadrageX" BETWEEN 0 AND 1
    AND "cadrageY" BETWEEN 0 AND 1
    AND "cadrageZoom" >= 1
  );
