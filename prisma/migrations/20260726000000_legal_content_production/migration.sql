-- Jurídico Radar: legal content production
-- Incremental migration over the existing Norma/NormaVersion/NormaDiff
-- and Matter/CaseFile models. No duplicate legal-norm or case core tables.

-- AlterTable: Norma
ALTER TABLE "Norma"
ADD COLUMN "jurisdiction" TEXT NOT NULL DEFAULT 'MX',
ADD COLUMN "matter" TEXT,
ADD COLUMN "officialSourceId" TEXT,
ADD COLUMN "publicationDate" TIMESTAMP(3),
ADD COLUMN "lastReformDate" TIMESTAMP(3),
ADD COLUMN "lastCheckedAt" TIMESTAMP(3),
ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN "currentHash" TEXT,
ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "monitoringStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "lastError" TEXT,
ADD COLUMN "practicalUse" TEXT;

-- AlterTable: NormaVersion
ALTER TABLE "NormaVersion"
ALTER COLUMN "publishedAt" DROP NOT NULL,
ADD COLUMN "versionLabel" TEXT,
ADD COLUMN "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "sourceUrl" TEXT;

-- AlterTable: Matter and CaseFile
ALTER TABLE "Matter"
ADD COLUMN "jurisdiction" TEXT,
ADD COLUMN "court" TEXT,
ADD COLUMN "caseNumber" TEXT,
ADD COLUMN "lastReviewedAt" TIMESTAMP(3);

ALTER TABLE "CaseFile"
ADD COLUMN "content" TEXT;

-- CreateTable
CREATE TABLE "NormaArticle" (
    "id" TEXT NOT NULL,
    "normaId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "heading" TEXT,
    "text" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormaArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormaReform" (
    "id" TEXT NOT NULL,
    "normaId" TEXT NOT NULL,
    "publicationDate" TIMESTAMP(3) NOT NULL,
    "officialUrl" TEXT NOT NULL,
    "description" TEXT,
    "articlesChanged" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormaReform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormaSourceVerification" (
    "id" TEXT NOT NULL,
    "normaId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "contentHash" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormaSourceVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jurisprudencia" (
    "id" TEXT NOT NULL,
    "registroDigital" TEXT,
    "rubro" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "matter" TEXT NOT NULL,
    "epoch" TEXT,
    "instance" TEXT,
    "issuingBody" TEXT,
    "publicationDate" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "officialUrl" TEXT,
    "officialSourceId" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jurisprudencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JurisprudenciaPrecedent" (
    "id" TEXT NOT NULL,
    "jurisprudenciaId" TEXT NOT NULL,
    "relatedRegistro" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JurisprudenciaPrecedent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JurisprudenciaContradiction" (
    "id" TEXT NOT NULL,
    "jurisprudenciaId" TEXT NOT NULL,
    "contradictionId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JurisprudenciaContradiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseParty" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rfc" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseActuation" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseActuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseDeadline" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "daysTotal" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseSourceCheck" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "result" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseSourceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseAlert" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseAlert_pkey" PRIMARY KEY ("id")
);

-- Indexes: Norma
CREATE INDEX "Norma_officialSourceId_idx" ON "Norma"("officialSourceId");
CREATE INDEX "Norma_jurisdiction_matter_idx" ON "Norma"("jurisdiction", "matter");
CREATE INDEX "Norma_verificationStatus_monitoringStatus_idx" ON "Norma"("verificationStatus", "monitoringStatus");
CREATE INDEX "Norma_lastCheckedAt_idx" ON "Norma"("lastCheckedAt");
CREATE INDEX "NormaVersion_verifiedAt_idx" ON "NormaVersion"("verifiedAt");
CREATE UNIQUE INDEX "NormaArticle_versionId_articleNumber_key" ON "NormaArticle"("versionId", "articleNumber");
CREATE INDEX "NormaArticle_normaId_articleNumber_idx" ON "NormaArticle"("normaId", "articleNumber");
CREATE UNIQUE INDEX "NormaReform_normaId_officialUrl_key" ON "NormaReform"("normaId", "officialUrl");
CREATE INDEX "NormaReform_normaId_publicationDate_idx" ON "NormaReform"("normaId", "publicationDate");
CREATE INDEX "NormaSourceVerification_normaId_checkedAt_idx" ON "NormaSourceVerification"("normaId", "checkedAt");
CREATE INDEX "NormaSourceVerification_status_checkedAt_idx" ON "NormaSourceVerification"("status", "checkedAt");

-- Indexes: Jurisprudencia
CREATE UNIQUE INDEX "Jurisprudencia_registroDigital_key" ON "Jurisprudencia"("registroDigital");
CREATE INDEX "Jurisprudencia_matter_type_idx" ON "Jurisprudencia"("matter", "type");
CREATE INDEX "Jurisprudencia_epoch_idx" ON "Jurisprudencia"("epoch");
CREATE INDEX "Jurisprudencia_instance_idx" ON "Jurisprudencia"("instance");
CREATE INDEX "Jurisprudencia_issuingBody_idx" ON "Jurisprudencia"("issuingBody");
CREATE INDEX "Jurisprudencia_verificationStatus_publicationDate_idx" ON "Jurisprudencia"("verificationStatus", "publicationDate");
CREATE INDEX "Jurisprudencia_officialSourceId_idx" ON "Jurisprudencia"("officialSourceId");

-- Indexes: Matter and case children
CREATE INDEX "Matter_organizationId_caseNumber_idx" ON "Matter"("organizationId", "caseNumber");
CREATE INDEX "CaseParty_matterId_idx" ON "CaseParty"("matterId");
CREATE INDEX "CaseActuation_matterId_date_idx" ON "CaseActuation"("matterId", "date");
CREATE INDEX "CaseDeadline_matterId_dueDate_idx" ON "CaseDeadline"("matterId", "dueDate");
CREATE INDEX "CaseDeadline_completed_dueDate_idx" ON "CaseDeadline"("completed", "dueDate");
CREATE INDEX "CaseSourceCheck_matterId_checkedAt_idx" ON "CaseSourceCheck"("matterId", "checkedAt");
CREATE INDEX "CaseAlert_matterId_read_idx" ON "CaseAlert"("matterId", "read");
CREATE INDEX "CaseAlert_level_createdAt_idx" ON "CaseAlert"("level", "createdAt");

-- Foreign keys: Norma
ALTER TABLE "Norma" ADD CONSTRAINT "Norma_officialSourceId_fkey" FOREIGN KEY ("officialSourceId") REFERENCES "OfficialSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NormaArticle" ADD CONSTRAINT "NormaArticle_normaId_fkey" FOREIGN KEY ("normaId") REFERENCES "Norma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NormaArticle" ADD CONSTRAINT "NormaArticle_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "NormaVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NormaReform" ADD CONSTRAINT "NormaReform_normaId_fkey" FOREIGN KEY ("normaId") REFERENCES "Norma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NormaSourceVerification" ADD CONSTRAINT "NormaSourceVerification_normaId_fkey" FOREIGN KEY ("normaId") REFERENCES "Norma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: Jurisprudencia
ALTER TABLE "Jurisprudencia" ADD CONSTRAINT "Jurisprudencia_officialSourceId_fkey" FOREIGN KEY ("officialSourceId") REFERENCES "OfficialSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JurisprudenciaPrecedent" ADD CONSTRAINT "JurisprudenciaPrecedent_jurisprudenciaId_fkey" FOREIGN KEY ("jurisprudenciaId") REFERENCES "Jurisprudencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JurisprudenciaContradiction" ADD CONSTRAINT "JurisprudenciaContradiction_jurisprudenciaId_fkey" FOREIGN KEY ("jurisprudenciaId") REFERENCES "Jurisprudencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: case children reuse Matter
ALTER TABLE "CaseParty" ADD CONSTRAINT "CaseParty_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseActuation" ADD CONSTRAINT "CaseActuation_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseDeadline" ADD CONSTRAINT "CaseDeadline_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseSourceCheck" ADD CONSTRAINT "CaseSourceCheck_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CaseAlert" ADD CONSTRAINT "CaseAlert_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
