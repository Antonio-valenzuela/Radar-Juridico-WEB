-- CreateEnum
CREATE TYPE "SourceQueryStatus" AS ENUM ('FOUND', 'NOT_FOUND', 'SOURCE_OFFLINE', 'CAPTCHA_REQUIRED', 'LOGIN_REQUIRED', 'RATE_LIMIT', 'UNKNOWN');

-- AlterTable
ALTER TABLE "JudicialBulletinEntry" 
  ADD COLUMN "status" "SourceQueryStatus" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
  ALTER COLUMN "sourceUrl" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "JudicialBulletinEntry_sourceId_expedienteNumber_court_key" ON "JudicialBulletinEntry"("sourceId", "expedienteNumber", "court");
