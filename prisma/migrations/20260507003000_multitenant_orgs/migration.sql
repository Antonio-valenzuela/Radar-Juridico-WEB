-- CreateTable
CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "dailyNotificationLimit" INTEGER NOT NULL DEFAULT 50,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUserRole" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrgUserRole_pkey" PRIMARY KEY ("id")
);

-- Create default organization for existing data.
INSERT INTO "Organization" ("id", "name", "slug", "dailyNotificationLimit", "updatedAt")
VALUES ('default-org', 'Default Organization', 'default', 50, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Alter watchlists and notification logs.
ALTER TABLE "Watchlist" ADD COLUMN "orgId" TEXT;
ALTER TABLE "NotificationLog" ADD COLUMN "orgId" TEXT;

UPDATE "Watchlist" SET "orgId" = 'default-org' WHERE "orgId" IS NULL;
UPDATE "NotificationLog" SET "orgId" = 'default-org' WHERE "orgId" IS NULL;

ALTER TABLE "Watchlist" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "NotificationLog" ALTER COLUMN "orgId" SET NOT NULL;

-- Backfill roles for existing users.
INSERT INTO "OrgUserRole" ("id", "orgId", "userId", "role")
SELECT 'role-' || "id", 'default-org', "id", 'owner'
FROM "User"
ON CONFLICT DO NOTHING;

-- Drop old uniqueness constraints if they exist.
DROP INDEX IF EXISTS "Watchlist_userId_type_value_key";
DROP INDEX IF EXISTS "NotificationLog_userId_itemId_channel_key";

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OrgUserRole_orgId_userId_key" ON "OrgUserRole"("orgId", "userId");

-- CreateIndex
CREATE INDEX "OrgUserRole_userId_idx" ON "OrgUserRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_orgId_userId_type_value_key" ON "Watchlist"("orgId", "userId", "type", "value");

-- CreateIndex
CREATE INDEX "Watchlist_orgId_idx" ON "Watchlist"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_orgId_userId_itemId_channel_key" ON "NotificationLog"("orgId", "userId", "itemId", "channel");

-- CreateIndex
CREATE INDEX "NotificationLog_orgId_sentAt_idx" ON "NotificationLog"("orgId", "sentAt");

-- AddForeignKey
ALTER TABLE "OrgUserRole" ADD CONSTRAINT "OrgUserRole_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUserRole" ADD CONSTRAINT "OrgUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
