-- AlterTable
ALTER TABLE "Item"
ADD COLUMN "sourceId" TEXT,
ADD COLUMN "canonicalUrl" TEXT,
ADD COLUMN "hash" TEXT,
ADD COLUMN "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "rawRef" TEXT,
ADD COLUMN "raw" JSONB;

-- Create missing baseline tables that existed in schema before this ingest expansion.
CREATE TABLE IF NOT EXISTS "Alert" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "keyword" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IngestRun" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "ok" BOOLEAN NOT NULL DEFAULT false,
  "itemsSaved" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  CONSTRAINT "IngestRun_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "IngestRun"
ADD COLUMN "itemsFound" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "duplicates" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "errorsCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "IngestCheckpoint" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "cursor" TEXT,
  "lastPublishedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IngestCheckpoint_pkey" PRIMARY KEY ("id")
);

-- Backfill canonical dedupe fields for existing rows.
UPDATE "Item"
SET "canonicalUrl" = "url"
WHERE "canonicalUrl" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Item_canonicalUrl_key" ON "Item"("canonicalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Item_hash_key" ON "Item"("hash");

-- CreateIndex
CREATE INDEX "Item_source_sourceId_idx" ON "Item"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Item_source_sourceId_key" ON "Item"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "IngestCheckpoint_source_key" ON "IngestCheckpoint"("source");
