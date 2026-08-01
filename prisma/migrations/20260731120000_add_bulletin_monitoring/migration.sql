ALTER TABLE "CaseDeadline"
  ADD COLUMN "dueTime" TEXT,
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
  ADD COLUMN "dayType" TEXT NOT NULL DEFAULT 'calendar_date',
  ADD COLUMN "calendarStatus" TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN "calculationNote" TEXT;

ALTER TABLE "CaseAlert"
  ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "CaseAlert_dedupeKey_key" ON "CaseAlert"("dedupeKey");

CREATE TABLE "CaseBulletinWatch" (
  "id" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "expedienteNumber" TEXT NOT NULL,
  "expedienteYear" INTEGER,
  "matterLabel" TEXT,
  "judicialDistrict" TEXT,
  "court" TEXT,
  "chamber" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastCheckedAt" TIMESTAMP(3),
  "lastPublishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CaseBulletinWatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseBulletinWatch_matterId_sourceId_expedienteNumber_key"
  ON "CaseBulletinWatch"("matterId", "sourceId", "expedienteNumber");
CREATE INDEX "CaseBulletinWatch_sourceId_active_idx" ON "CaseBulletinWatch"("sourceId", "active");
CREATE INDEX "CaseBulletinWatch_matterId_active_idx" ON "CaseBulletinWatch"("matterId", "active");

CREATE TABLE "JudicialBulletinEntry" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "matterId" TEXT,
  "externalId" TEXT,
  "expedienteNumber" TEXT NOT NULL,
  "expedienteYear" INTEGER,
  "matterLabel" TEXT,
  "judicialDistrict" TEXT,
  "court" TEXT,
  "chamber" TEXT,
  "bulletinNumber" TEXT,
  "publicationDate" TIMESTAMP(3),
  "agreementDate" TIMESTAMP(3),
  "proceedingType" TEXT,
  "heading" TEXT,
  "extract" TEXT,
  "parties" JSONB,
  "sourceUrl" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "raw" JSONB,
  "verificationStatus" TEXT NOT NULL DEFAULT 'official_source',
  "reviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewedAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "JudicialBulletinEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JudicialBulletinEntry_dedupeKey_key" ON "JudicialBulletinEntry"("dedupeKey");
CREATE INDEX "JudicialBulletinEntry_sourceId_expedienteNumber_idx" ON "JudicialBulletinEntry"("sourceId", "expedienteNumber");
CREATE INDEX "JudicialBulletinEntry_matterId_publicationDate_idx" ON "JudicialBulletinEntry"("matterId", "publicationDate");
CREATE INDEX "JudicialBulletinEntry_court_expedienteNumber_publicationDate_idx" ON "JudicialBulletinEntry"("court", "expedienteNumber", "publicationDate");
CREATE INDEX "JudicialBulletinEntry_contentHash_idx" ON "JudicialBulletinEntry"("contentHash");

CREATE TABLE "BulletinCheckRun" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "matterId" TEXT,
  "watchId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL,
  "query" JSONB NOT NULL,
  "resultsFound" INTEGER NOT NULL DEFAULT 0,
  "newResults" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "responseHash" TEXT,
  "sourceUrl" TEXT,
  "httpStatus" INTEGER,
  "durationMs" INTEGER,
  CONSTRAINT "BulletinCheckRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BulletinCheckRun_sourceId_startedAt_idx" ON "BulletinCheckRun"("sourceId", "startedAt");
CREATE INDEX "BulletinCheckRun_matterId_startedAt_idx" ON "BulletinCheckRun"("matterId", "startedAt");
CREATE INDEX "BulletinCheckRun_status_startedAt_idx" ON "BulletinCheckRun"("status", "startedAt");

ALTER TABLE "CaseActuation" ADD COLUMN "bulletinEntryId" TEXT;
CREATE UNIQUE INDEX "CaseActuation_bulletinEntryId_key" ON "CaseActuation"("bulletinEntryId");

ALTER TABLE "CaseBulletinWatch"
  ADD CONSTRAINT "CaseBulletinWatch_matterId_fkey"
  FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CaseBulletinWatch_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "OfficialSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JudicialBulletinEntry"
  ADD CONSTRAINT "JudicialBulletinEntry_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "OfficialSource"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "JudicialBulletinEntry_matterId_fkey"
  FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BulletinCheckRun"
  ADD CONSTRAINT "BulletinCheckRun_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "OfficialSource"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BulletinCheckRun_matterId_fkey"
  FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "BulletinCheckRun_watchId_fkey"
  FOREIGN KEY ("watchId") REFERENCES "CaseBulletinWatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaseActuation"
  ADD CONSTRAINT "CaseActuation_bulletinEntryId_fkey"
  FOREIGN KEY ("bulletinEntryId") REFERENCES "JudicialBulletinEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Make the already-seeded Jalisco source use the public adapter. This is an
-- idempotent data correction and does not remove any source or document data.
UPDATE "OfficialSource"
SET "adapter" = 'JALISCO_BULLETIN',
    "requiresBrowser" = false,
    "crawlMode" = 'api',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE lower("slug") = 'boletin_judicial_jalisco';

INSERT INTO "OfficialSource" (
  "id", "name", "slug", "baseUrl", "healthUrl", "adapter", "requiresBrowser",
  "type", "jurisdiction", "country", "state", "matter", "description",
  "isActive", "isOfficial", "trustLevel", "crawlMode", "refreshFrequency",
  "createdAt", "updatedAt"
)
VALUES (
  'source_bulletin_tjajal',
  'Tribunal de Justicia Administrativa de Jalisco - Boletines',
  'boletin_tjajal',
  'https://tjajal.gob.mx/boletines',
  'https://tjajal.gob.mx/boletines',
  'TJAJAL_BULLETIN', false, 'court', 'State', 'MX', 'Jalisco', 'administrativo',
  'Punto de extensión para boletines del TJA Jalisco; requiere revisión manual mientras no exista API pública estable.',
  true, true, 'official', 'search_only', 'daily', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "adapter" = EXCLUDED."adapter",
  "baseUrl" = EXCLUDED."baseUrl",
  "healthUrl" = EXCLUDED."healthUrl",
  "requiresBrowser" = EXCLUDED."requiresBrowser",
  "crawlMode" = EXCLUDED."crawlMode",
  "updatedAt" = CURRENT_TIMESTAMP;
