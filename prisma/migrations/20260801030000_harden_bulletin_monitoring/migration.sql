-- Additive hardening for bulletin evidence, per-matter associations and
-- idempotent side effects. No legacy column or row is removed.

ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE UNIQUE INDEX "AuditLog_dedupeKey_key" ON "AuditLog"("dedupeKey");

ALTER TABLE "CaseBulletinWatch"
  ADD COLUMN "subjectExternalId" TEXT,
  ADD COLUMN "districtExternalId" TEXT,
  ADD COLUMN "courtExternalId" TEXT,
  ADD COLUMN "lastSuccessfulAt" TIMESTAMP(3),
  ADD COLUMN "nextCheckAt" TIMESTAMP(3),
  ADD COLUMN "lastQueryStatus" TEXT,
  ADD COLUMN "lastPublicationStatus" TEXT,
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "lastErrorMessage" TEXT;
CREATE INDEX "CaseBulletinWatch_active_lastCheckedAt_idx" ON "CaseBulletinWatch"("active", "lastCheckedAt");

ALTER TABLE "JudicialBulletinEntry"
  ADD COLUMN "evidenceKind" TEXT NOT NULL DEFAULT 'legacy_unclassified',
  ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'OFFICIAL_PUBLIC_SOURCE',
  ADD COLUMN "adapterVersion" TEXT,
  ADD COLUMN "publicationDateRaw" TEXT,
  ADD COLUMN "agreementDateRaw" TEXT,
  ADD COLUMN "evidence" JSONB;

ALTER TABLE "BulletinCheckRun"
  ADD COLUMN "queryStatus" TEXT,
  ADD COLUMN "publicationStatus" TEXT,
  ADD COLUMN "contentType" TEXT,
  ADD COLUMN "adapterVersion" TEXT,
  ADD COLUMN "origin" TEXT,
  ADD COLUMN "evidence" JSONB;
CREATE INDEX "BulletinCheckRun_watchId_startedAt_idx" ON "BulletinCheckRun"("watchId", "startedAt");

-- Preserve legacy semantics while separating technical query state from
-- publication state. Unknown historical failures never become "not found".
UPDATE "BulletinCheckRun"
SET
  "queryStatus" = CASE
    WHEN "status" IN ('PUBLISHED', 'NOT_FOUND_AS_OF') THEN 'SUCCESS'
    WHEN "status" IN ('SOURCE_UNAVAILABLE', 'SOURCE_CHANGED', 'AUTH_REQUIRED', 'INVALID_QUERY', 'PENDING_RETRY', 'MANUAL_REVIEW', 'UNSUPPORTED') THEN "status"
    ELSE 'PROVIDER_ERROR'
  END,
  "publicationStatus" = CASE
    WHEN "status" = 'PUBLISHED' THEN 'HAS_PREVIOUS_PUBLICATIONS'
    WHEN "status" = 'NOT_FOUND_AS_OF' THEN 'NO_PUBLICATION_FOUND_AS_OF'
    ELSE 'UNKNOWN'
  END
WHERE "queryStatus" IS NULL OR "publicationStatus" IS NULL;

CREATE TABLE "MatterBulletinEntry" (
  "id" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "bulletinEntryId" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewedAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "MatterBulletinEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatterBulletinEntry_matterId_bulletinEntryId_key" ON "MatterBulletinEntry"("matterId", "bulletinEntryId");
CREATE INDEX "MatterBulletinEntry_matterId_lastSeenAt_idx" ON "MatterBulletinEntry"("matterId", "lastSeenAt");
CREATE INDEX "MatterBulletinEntry_bulletinEntryId_idx" ON "MatterBulletinEntry"("bulletinEntryId");

ALTER TABLE "MatterBulletinEntry"
  ADD CONSTRAINT "MatterBulletinEntry_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MatterBulletinEntry_bulletinEntryId_fkey" FOREIGN KEY ("bulletinEntryId") REFERENCES "JudicialBulletinEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "MatterBulletinEntry" ("id", "matterId", "bulletinEntryId", "firstSeenAt", "lastSeenAt", "reviewed", "reviewedAt", "notes")
SELECT 'legacy_' || "id", "matterId", "id", "firstSeenAt", "lastSeenAt", "reviewed", "reviewedAt", "notes"
FROM "JudicialBulletinEntry"
WHERE "matterId" IS NOT NULL
ON CONFLICT ("matterId", "bulletinEntryId") DO NOTHING;

ALTER TABLE "CaseActuation" ADD COLUMN "matterBulletinEntryId" TEXT;
CREATE UNIQUE INDEX "CaseActuation_matterBulletinEntryId_key" ON "CaseActuation"("matterBulletinEntryId");
ALTER TABLE "CaseActuation"
  ADD CONSTRAINT "CaseActuation_matterBulletinEntryId_fkey" FOREIGN KEY ("matterBulletinEntryId") REFERENCES "MatterBulletinEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "CaseActuation" AS actuation
SET "matterBulletinEntryId" = link."id"
FROM "MatterBulletinEntry" AS link
WHERE actuation."bulletinEntryId" = link."bulletinEntryId"
  AND actuation."matterId" = link."matterId"
  AND actuation."matterBulletinEntryId" IS NULL;

-- Existing rows came from the legacy per-expedient lookup, which did not prove
-- an actual bulletin publication. Do not upgrade them retroactively.
UPDATE "JudicialBulletinEntry"
SET "evidenceKind" = 'legacy_unclassified'
WHERE "evidenceKind" = 'legacy_unclassified';
