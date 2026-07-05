-- CreateTable
CREATE TABLE "ItemAiEnrichment" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "authority" TEXT,
    "entities" JSONB NOT NULL,
    "affectedSectors" JSONB NOT NULL,
    "keywords" JSONB NOT NULL,
    "relatedTopics" JSONB NOT NULL,
    "impactLevel" TEXT NOT NULL,
    "executiveSummary" TEXT,
    "explanation" TEXT,
    "provider" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemAiEnrichment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemAiEnrichment_itemId_key" ON "ItemAiEnrichment"("itemId");

-- AddForeignKey
ALTER TABLE "ItemAiEnrichment" ADD CONSTRAINT "ItemAiEnrichment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
