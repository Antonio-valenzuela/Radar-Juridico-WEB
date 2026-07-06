-- Additive metadata-only migration for legal change monitoring.

ALTER TABLE "Document"
ADD COLUMN "shortCode" TEXT,
ADD COLUMN "matter" TEXT,
ADD COLUMN "officialSourceId" TEXT,
ADD COLUMN "officialUrl" TEXT,
ADD COLUMN "officialSourceUrl" TEXT,
ADD COLUMN "currentHash" TEXT,
ADD COLUMN "etag" TEXT,
ADD COLUMN "lastModified" TIMESTAMP(3),
ADD COLUMN "fileSize" BIGINT,
ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN "lastError" TEXT,
ADD COLUMN "monitoringStatus" TEXT,
ADD COLUMN "changeSummary" TEXT;

ALTER TABLE "DocumentVersion"
ADD COLUMN "etag" TEXT,
ADD COLUMN "lastModified" TIMESTAMP(3),
ADD COLUMN "fileSize" BIGINT,
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "metadata" JSONB;

ALTER TABLE "DocumentChange"
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "previousHash" TEXT,
ADD COLUMN "newHash" TEXT,
ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'media',
ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'nueva',
ADD COLUMN "matter" TEXT,
ADD COLUMN "jurisdiction" TEXT;

CREATE INDEX "Document_matter_monitoringStatus_idx" ON "Document"("matter", "monitoringStatus");
CREATE INDEX "Document_officialSourceId_idx" ON "Document"("officialSourceId");
CREATE INDEX "Document_lastCheckedAt_idx" ON "Document"("lastCheckedAt");
CREATE INDEX "Document_shortCode_idx" ON "Document"("shortCode");
CREATE INDEX "DocumentVersion_documentId_createdAt_idx" ON "DocumentVersion"("documentId", "createdAt");

ALTER TABLE "Document"
ADD CONSTRAINT "Document_officialSourceId_fkey"
FOREIGN KEY ("officialSourceId") REFERENCES "OfficialSource"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
