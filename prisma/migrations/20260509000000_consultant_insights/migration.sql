CREATE TABLE "ConsultantInsight" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "diffId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "executiveSummary" TEXT NOT NULL,
  "keyChanges" JSONB NOT NULL,
  "affectedParties" JSONB NOT NULL,
  "actionItems" JSONB NOT NULL,
  "riskFlags" JSONB NOT NULL,
  "followUpQuestions" JSONB NOT NULL,
  "confidence" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ConsultantInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConsultantInsight_itemId_inputHash_promptVersion_key" ON "ConsultantInsight"("itemId", "inputHash", "promptVersion");
CREATE INDEX "ConsultantInsight_itemId_generatedAt_idx" ON "ConsultantInsight"("itemId", "generatedAt");
CREATE INDEX "ConsultantInsight_diffId_idx" ON "ConsultantInsight"("diffId");

ALTER TABLE "ConsultantInsight" ADD CONSTRAINT "ConsultantInsight_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultantInsight" ADD CONSTRAINT "ConsultantInsight_diffId_fkey" FOREIGN KEY ("diffId") REFERENCES "NormaDiff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
