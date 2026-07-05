-- CreateTable
CREATE TABLE "OfficialSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'MX',
    "country" TEXT NOT NULL DEFAULT 'MX',
    "state" TEXT,
    "matter" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOfficial" BOOLEAN NOT NULL DEFAULT true,
    "trustLevel" TEXT NOT NULL DEFAULT 'official',
    "crawlMode" TEXT NOT NULL DEFAULT 'api',
    "refreshFrequency" TEXT NOT NULL DEFAULT 'daily',
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastErrorCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialSourceFetchLog" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "foundItems" INTEGER NOT NULL DEFAULT 0,
    "savedItems" INTEGER NOT NULL DEFAULT 0,
    "duplicateItems" INTEGER NOT NULL DEFAULT 0,
    "errorCategory" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficialSourceFetchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfficialSource_slug_key" ON "OfficialSource"("slug");

-- CreateIndex
CREATE INDEX "OfficialSource_type_idx" ON "OfficialSource"("type");

-- CreateIndex
CREATE INDEX "OfficialSource_isActive_idx" ON "OfficialSource"("isActive");

-- CreateIndex
CREATE INDEX "OfficialSource_trustLevel_idx" ON "OfficialSource"("trustLevel");

-- CreateIndex
CREATE INDEX "OfficialSourceFetchLog_sourceId_createdAt_idx" ON "OfficialSourceFetchLog"("sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "OfficialSourceFetchLog_createdAt_idx" ON "OfficialSourceFetchLog"("createdAt");

-- AddForeignKey
ALTER TABLE "OfficialSourceFetchLog" ADD CONSTRAINT "OfficialSourceFetchLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "OfficialSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
