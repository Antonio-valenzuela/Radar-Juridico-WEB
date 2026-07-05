import { prisma } from '@/lib/prisma';

async function main() {
  try {
    await prisma.$executeRaw`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "hasVersions" BOOLEAN NOT NULL DEFAULT false`;
    console.log('hasVersions: OK');

    await prisma.$executeRaw`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "latestVersionHash" TEXT`;
    console.log('latestVersionHash: OK');

    await prisma.$executeRaw`ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT NOT NULL DEFAULT 'MX'`;
    console.log('jurisdiction: OK');
    
    await prisma.$executeRaw`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "versionNumber" INTEGER NOT NULL DEFAULT 1`;
    console.log('versionNumber: OK');

    await prisma.$executeRaw`ALTER TABLE "DocumentVersion" ADD COLUMN IF NOT EXISTS "originalText" TEXT`;
    console.log('originalText: OK');

    // Create DocumentChange table if not exists
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "DocumentChange" (
        "id" TEXT NOT NULL,
        "documentVersionId" TEXT NOT NULL,
        "changeType" TEXT NOT NULL,
        "before" TEXT,
        "after" TEXT,
        "changeDescription" TEXT NOT NULL,
        "extractedPlazoDias" INTEGER,
        "extractedPorcentaje" DOUBLE PRECISION,
        "extractedMontoMX" DOUBLE PRECISION,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DocumentChange_pkey" PRIMARY KEY ("id")
      )
    `;
    console.log('DocumentChange: OK');

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "DocumentChange_documentVersionId_idx" ON "DocumentChange"("documentVersionId")
    `;

    // Create UserAlert table if not exists
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "UserAlert" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "keywords" TEXT[] NOT NULL DEFAULT '{}',
        "filters" JSONB,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "UserAlert_pkey" PRIMARY KEY ("id")
      )
    `;
    console.log('UserAlert: OK');

    // Create AlertNotification table if not exists
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "AlertNotification" (
        "id" TEXT NOT NULL,
        "alertId" TEXT NOT NULL,
        "documentId" TEXT,
        "title" TEXT NOT NULL,
        "summary" TEXT NOT NULL,
        "relevance" DOUBLE PRECISION NOT NULL,
        "read" BOOLEAN NOT NULL DEFAULT false,
        "emailSent" BOOLEAN NOT NULL DEFAULT false,
        "sentAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AlertNotification_pkey" PRIMARY KEY ("id")
      )
    `;
    console.log('AlertNotification: OK');

    // DocumentVersion unique constraint on (documentId, versionNumber) - handle if already exists
    try {
      await prisma.$executeRaw`
        ALTER TABLE "DocumentVersion" 
        ADD CONSTRAINT "DocumentVersion_documentId_versionNumber_key" 
        UNIQUE ("documentId", "versionNumber")
      `;
      console.log('DocumentVersion unique: OK');
    } catch (e: any) {
      if (e.message.includes('already exists')) {
        console.log('DocumentVersion unique: already exists');
      } else {
        throw e;
      }
    }

    process.exit(0);
  } catch (e: any) {
    console.error('MIGRATION ERROR:', e.message);
    process.exit(1);
  }
}

main();
