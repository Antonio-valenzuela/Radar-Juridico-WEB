-- CreateTable
CREATE TABLE "MetricsDaily" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "sourceCounts" JSONB NOT NULL,
  "impactCounts" JSONB NOT NULL,
  "topicCounts" JSONB NOT NULL,
  "typeCounts" JSONB NOT NULL,
  "topNormas" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MetricsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetricsDaily_date_key" ON "MetricsDaily"("date");

-- CreateIndex
CREATE INDEX "MetricsDaily_date_idx" ON "MetricsDaily"("date");
