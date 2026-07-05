-- CreateTable
CREATE TABLE "Norma" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "sigla" TEXT,
  "fuente" TEXT NOT NULL,
  "urlBase" TEXT,
  "aliases" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Norma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormaVersion" (
  "id" TEXT NOT NULL,
  "normaId" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "hash" TEXT NOT NULL,
  "textPath" TEXT,
  "text" TEXT,
  "sourceItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NormaVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormaDiff" (
  "id" TEXT NOT NULL,
  "fromVersionId" TEXT,
  "toVersionId" TEXT NOT NULL,
  "changedArticles" JSONB NOT NULL,
  "summaryBullets" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NormaDiff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Norma_fuente_nombre_key" ON "Norma"("fuente", "nombre");

-- CreateIndex
CREATE INDEX "Norma_sigla_idx" ON "Norma"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "NormaVersion_normaId_hash_key" ON "NormaVersion"("normaId", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "NormaVersion_sourceItemId_key" ON "NormaVersion"("sourceItemId");

-- CreateIndex
CREATE INDEX "NormaVersion_normaId_publishedAt_idx" ON "NormaVersion"("normaId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NormaDiff_toVersionId_key" ON "NormaDiff"("toVersionId");

-- CreateIndex
CREATE INDEX "NormaDiff_fromVersionId_idx" ON "NormaDiff"("fromVersionId");

-- AddForeignKey
ALTER TABLE "NormaVersion" ADD CONSTRAINT "NormaVersion_normaId_fkey" FOREIGN KEY ("normaId") REFERENCES "Norma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormaVersion" ADD CONSTRAINT "NormaVersion_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormaDiff" ADD CONSTRAINT "NormaDiff_fromVersionId_fkey" FOREIGN KEY ("fromVersionId") REFERENCES "NormaVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormaDiff" ADD CONSTRAINT "NormaDiff_toVersionId_fkey" FOREIGN KEY ("toVersionId") REFERENCES "NormaVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
