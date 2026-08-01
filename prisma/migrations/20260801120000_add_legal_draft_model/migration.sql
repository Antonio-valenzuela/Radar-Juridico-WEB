-- CreateTable
CREATE TABLE "LegalDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'machote',
    "matter" TEXT,
    "jurisdiction" TEXT DEFAULT 'federal',
    "formData" JSONB,
    "renderedText" TEXT,
    "pendingMarkers" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalDraft_organizationId_status_idx" ON "LegalDraft"("organizationId", "status");

-- CreateIndex
CREATE INDEX "LegalDraft_userId_status_idx" ON "LegalDraft"("userId", "status");

-- CreateIndex
CREATE INDEX "LegalDraft_organizationId_updatedAt_idx" ON "LegalDraft"("organizationId", "updatedAt");
