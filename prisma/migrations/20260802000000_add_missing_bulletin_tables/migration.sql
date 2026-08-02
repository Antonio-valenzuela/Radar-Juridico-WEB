-- Create missing BulletinSubscription table
CREATE TABLE "BulletinSubscription" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "sourceId" TEXT NOT NULL,
  "expediente" TEXT,
  "actor" TEXT,
  "demandado" TEXT,
  "juzgado" TEXT,
  "abogado" TEXT,
  "keywords" JSONB,
  "frequency" TEXT NOT NULL DEFAULT 'diario',
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastRunAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3),
  "lastQueryStatus" TEXT,
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BulletinSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BulletinSubscription_organizationId_idx" ON "BulletinSubscription"("organizationId");
CREATE INDEX "BulletinSubscription_sourceId_idx" ON "BulletinSubscription"("sourceId");
CREATE INDEX "BulletinSubscription_status_idx" ON "BulletinSubscription"("status");

ALTER TABLE "BulletinSubscription"
  ADD CONSTRAINT "BulletinSubscription_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "OfficialSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create missing BulletinMatch table
CREATE TABLE "BulletinMatch" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "publicationId" TEXT,
  "publicationTitle" TEXT,
  "publicationExtract" TEXT,
  "publicationUrl" TEXT,
  "publicationDate" TIMESTAMP(3),
  "court" TEXT,
  "expediente" TEXT,
  "matchReason" TEXT NOT NULL,
  "matchedFields" JSONB,
  "score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notifiedAt" TIMESTAMP(3),
  "reviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "BulletinMatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BulletinMatch_subscriptionId_seenAt_idx" ON "BulletinMatch"("subscriptionId", "seenAt");
CREATE INDEX "BulletinMatch_subscriptionId_reviewed_idx" ON "BulletinMatch"("subscriptionId", "reviewed");

ALTER TABLE "BulletinMatch"
  ADD CONSTRAINT "BulletinMatch_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "BulletinSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;