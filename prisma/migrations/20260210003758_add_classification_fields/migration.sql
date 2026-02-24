-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "impacto" TEXT,
ADD COLUMN     "tema" TEXT,
ADD COLUMN     "tipo" TEXT;

-- CreateIndex
CREATE INDEX "Item_impacto_tema_published_idx" ON "Item"("impacto", "tema", "published");
