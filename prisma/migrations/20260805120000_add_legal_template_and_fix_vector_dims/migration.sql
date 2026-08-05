-- Migration: add_legal_template_and_fix_vector_dims
-- Safe migration that handles existing LegalTemplate table from a prior db push.

-- 1. Add TemplateVisibility enum (skip if exists)
DO $$ BEGIN
  CREATE TYPE "TemplateVisibility" AS ENUM ('PRIVATE', 'ORG', 'PUBLIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create LegalTemplate table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS "LegalTemplate" (
    "id"             TEXT NOT NULL,
    "slug"           TEXT,
    "title"          TEXT NOT NULL,
    "category"       TEXT NOT NULL DEFAULT 'General',
    "jurisdiction"   TEXT NOT NULL DEFAULT 'federal',
    "practiceArea"   TEXT,
    "documentType"   TEXT NOT NULL DEFAULT 'machote',
    "description"    TEXT,
    "content"        TEXT,
    "originalText"   TEXT,
    "legalBasis"     TEXT,
    "variables"      JSONB,
    "structureJson"  JSONB,
    "applicableLaws" JSONB,
    "warnings"       JSONB,
    "disclaimer"     TEXT,
    "exportFormats"  JSONB,
    "aiInstructions" TEXT,
    "systemPrompt"   TEXT,
    "contentHash"    TEXT,
    "version"        INTEGER NOT NULL DEFAULT 1,
    "visibility"     "TemplateVisibility" NOT NULL DEFAULT 'ORG',
    "organizationId" TEXT NOT NULL,
    "createdBy"      TEXT,
    "sourceFileName" TEXT,
    "indexed"        BOOLEAN NOT NULL DEFAULT false,
    "indexedAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalTemplate_pkey" PRIMARY KEY ("id")
);

-- 3. Add missing columns to existing LegalTemplate (idempotent)
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT NOT NULL DEFAULT 'federal';
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "practiceArea" TEXT;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "content" TEXT;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "originalText" TEXT;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "variables" JSONB;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "structureJson" JSONB;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "applicableLaws" JSONB;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "warnings" JSONB;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "disclaimer" TEXT;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "exportFormats" JSONB;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "aiInstructions" TEXT;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "systemPrompt" TEXT;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "visibility" "TemplateVisibility" NOT NULL DEFAULT 'ORG';
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "indexed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "indexedAt" TIMESTAMP(3);
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "LegalTemplate" ADD COLUMN IF NOT EXISTS "sourceFileName" TEXT;

-- 4. Unique and indexes for LegalTemplate (IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "LegalTemplate_organizationId_slug_key" ON "LegalTemplate"("organizationId", "slug");
CREATE INDEX IF NOT EXISTS "LegalTemplate_organizationId_updatedAt_idx" ON "LegalTemplate"("organizationId", "updatedAt");
CREATE INDEX IF NOT EXISTS "LegalTemplate_createdBy_idx" ON "LegalTemplate"("createdBy");
CREATE INDEX IF NOT EXISTS "LegalTemplate_category_idx" ON "LegalTemplate"("category");
CREATE INDEX IF NOT EXISTS "LegalTemplate_contentHash_idx" ON "LegalTemplate"("contentHash");

-- 5. Add templateId FK index to LegalDraft
CREATE INDEX IF NOT EXISTS "LegalDraft_templateId_idx" ON "LegalDraft"("templateId");

-- 6. Fix vector dimensions: drop old 1536d column, recreate as 1024d
-- (Existing embeddings are local SHA-256 dev fallbacks — no production data is lost)
ALTER TABLE "Embedding" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "Embedding" ADD COLUMN IF NOT EXISTS "embedding" vector(1024);
