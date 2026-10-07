-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "utilisateurId" UUID NOT NULL,
    "jetonHache" TEXT NOT NULL,
    "creeLe" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expireLe" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_jetonHache_key" ON "session"("jetonHache");

-- CreateIndex
CREATE INDEX "session_utilisateurId_idx" ON "session"("utilisateurId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
