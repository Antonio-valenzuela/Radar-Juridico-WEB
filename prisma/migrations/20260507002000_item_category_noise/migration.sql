-- AlterTable
ALTER TABLE "Item" ADD COLUMN "category" TEXT;

-- Backfill clear low-value DOF/financial bulletin noise.
UPDATE "Item"
SET "category" = 'ruido',
    "impacto" = 'bajo'
WHERE "title" ~* '(Tipo de cambio|Tasas de inter[eé]s|TIIE|INPC|subasta|aviso REF)';

-- Backfill obvious normative items.
UPDATE "Item"
SET "category" = 'normativo',
    "impacto" = 'alto'
WHERE "title" ~* '(DECRETO|REFORMA|REFORMAN|ABROGA|DEROGA)'
  AND COALESCE("category", '') <> 'ruido';

-- Default remaining rows to administrative.
UPDATE "Item"
SET "category" = 'administrativo'
WHERE "category" IS NULL;

-- CreateIndex
CREATE INDEX "Item_category_published_idx" ON "Item"("category", "published");
