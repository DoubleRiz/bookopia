-- CreateEnum
CREATE TYPE "RoleDoublePage" AS ENUM ('couverture', 'interieur', 'quatrieme');

-- CreateEnum
CREATE TYPE "NatureEmplacement" AS ENUM ('photo', 'texte');

-- CreateEnum
CREATE TYPE "StatutExport" AS ENUM ('demande', 'en_cours', 'reussi', 'echec');

-- CreateEnum
CREATE TYPE "SourcePhoto" AS ENUM ('upload', 'google_photos');

-- CreateTable
CREATE TABLE "utilisateur" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "motDePasseHache" TEXT NOT NULL,
    "nomAffichage" TEXT NOT NULL,
    "creeLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projet" (
    "id" UUID NOT NULL,
    "utilisateurId" UUID NOT NULL,
    "titre" TEXT NOT NULL,
    "themeId" UUID NOT NULL,
    "brouillon" BOOLEAN NOT NULL DEFAULT true,
    "modeleOrigineId" UUID,
    "creeLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifieLe" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo" (
    "id" UUID NOT NULL,
    "projetId" UUID NOT NULL,
    "cleStockage" TEXT NOT NULL,
    "nomFichierOrigine" TEXT NOT NULL,
    "empreinteFichier" TEXT NOT NULL,
    "largeurPx" INTEGER NOT NULL,
    "hauteurPx" INTEGER NOT NULL,
    "priseLe" TIMESTAMPTZ(3),
    "sourceType" "SourcePhoto" NOT NULL,
    "creeLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gabarit" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "role" "RoleDoublePage" NOT NULL,
    "famille" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "gabarit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theme" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "policeTitre" TEXT NOT NULL,
    "policeTexte" TEXT NOT NULL,
    "palette" JSONB NOT NULL,
    "rayonAngles" DOUBLE PRECISION NOT NULL,
    "bordureCadre" JSONB,
    "margeInterieure" DOUBLE PRECISION NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modeleLivre" (
    "id" UUID NOT NULL,
    "nom" TEXT NOT NULL,
    "themeId" UUID NOT NULL,
    "gabaritCouvertureId" UUID NOT NULL,
    "gabaritQuatriemeId" UUID NOT NULL,
    "famille" TEXT NOT NULL,
    "nombreDoublesPagesDepart" INTEGER NOT NULL,
    "cleApercu" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "modeleLivre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doublePage" (
    "id" UUID NOT NULL,
    "projetId" UUID NOT NULL,
    "role" "RoleDoublePage" NOT NULL,
    "position" INTEGER,
    "gabaritOrigineId" UUID,
    "creeLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doublePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emplacement" (
    "id" UUID NOT NULL,
    "projetId" UUID NOT NULL,
    "doublePageId" UUID NOT NULL,
    "indice" INTEGER NOT NULL,
    "nature" "NatureEmplacement" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "largeur" DOUBLE PRECISION NOT NULL,
    "hauteur" DOUBLE PRECISION NOT NULL,
    "photoId" UUID,
    "cadrageX" DOUBLE PRECISION,
    "cadrageY" DOUBLE PRECISION,
    "cadrageZoom" DOUBLE PRECISION,
    "contenuTexte" TEXT,

    CONSTRAINT "emplacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export" (
    "id" UUID NOT NULL,
    "projetId" UUID NOT NULL,
    "statut" "StatutExport" NOT NULL DEFAULT 'demande',
    "demandeLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termineLe" TIMESTAMPTZ(3),
    "cleStockage" TEXT,
    "messageErreur" TEXT,

    CONSTRAINT "export_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_email_key" ON "utilisateur"("email");

-- CreateIndex
CREATE INDEX "projet_utilisateurId_idx" ON "projet"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "photo_cleStockage_key" ON "photo"("cleStockage");

-- CreateIndex
CREATE UNIQUE INDEX "photo_projetId_empreinteFichier_key" ON "photo"("projetId", "empreinteFichier");

-- CreateIndex
CREATE INDEX "gabarit_role_famille_idx" ON "gabarit"("role", "famille");

-- CreateIndex
CREATE INDEX "doublePage_projetId_idx" ON "doublePage"("projetId");

-- CreateIndex
CREATE INDEX "emplacement_projetId_idx" ON "emplacement"("projetId");

-- CreateIndex
CREATE INDEX "emplacement_photoId_idx" ON "emplacement"("photoId");

-- CreateIndex
CREATE UNIQUE INDEX "emplacement_doublePageId_indice_key" ON "emplacement"("doublePageId", "indice");

-- CreateIndex
CREATE UNIQUE INDEX "export_projetId_key" ON "export"("projetId");

-- CreateIndex
CREATE INDEX "export_statut_demandeLe_idx" ON "export"("statut", "demandeLe");

-- AddForeignKey
ALTER TABLE "projet" ADD CONSTRAINT "projet_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projet" ADD CONSTRAINT "projet_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projet" ADD CONSTRAINT "projet_modeleOrigineId_fkey" FOREIGN KEY ("modeleOrigineId") REFERENCES "modeleLivre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo" ADD CONSTRAINT "photo_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modeleLivre" ADD CONSTRAINT "modeleLivre_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modeleLivre" ADD CONSTRAINT "modeleLivre_gabaritCouvertureId_fkey" FOREIGN KEY ("gabaritCouvertureId") REFERENCES "gabarit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modeleLivre" ADD CONSTRAINT "modeleLivre_gabaritQuatriemeId_fkey" FOREIGN KEY ("gabaritQuatriemeId") REFERENCES "gabarit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doublePage" ADD CONSTRAINT "doublePage_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doublePage" ADD CONSTRAINT "doublePage_gabaritOrigineId_fkey" FOREIGN KEY ("gabaritOrigineId") REFERENCES "gabarit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emplacement" ADD CONSTRAINT "emplacement_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emplacement" ADD CONSTRAINT "emplacement_doublePageId_fkey" FOREIGN KEY ("doublePageId") REFERENCES "doublePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emplacement" ADD CONSTRAINT "emplacement_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export" ADD CONSTRAINT "export_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
