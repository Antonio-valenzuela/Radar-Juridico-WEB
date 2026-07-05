CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL DEFAULT 'MX',
  "documentType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "canonicalKey" TEXT NOT NULL,
  "canonicalUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionLabel" TEXT,
  "publishedAt" TIMESTAMP(3),
  "effectiveFrom" TIMESTAMP(3),
  "contentHash" TEXT NOT NULL,
  "rawRef" TEXT,
  "rawText" TEXT,
  "diffSummary" JSONB,
  "sourceItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentMetadata" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "normalizedValue" TEXT,
  "confidence" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentMetadata_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentChunk" (
  "id" TEXT NOT NULL,
  "documentVersionId" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "sectionPath" TEXT,
  "article" TEXT,
  "text" TEXT NOT NULL,
  "tokenCount" INTEGER NOT NULL,
  "citationAnchor" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Embedding" (
  "id" TEXT NOT NULL,
  "chunkId" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "embedding" vector(1536),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "ruleType" TEXT NOT NULL,
  "query" TEXT,
  "filters" JSONB,
  "frequency" TEXT NOT NULL DEFAULT 'daily',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "alertRuleId" TEXT,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "documentVersionId" TEXT,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "payload" JSONB,
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcessingJob" (
  "id" TEXT NOT NULL,
  "queueName" TEXT NOT NULL,
  "jobName" TEXT NOT NULL,
  "jobId" TEXT,
  "type" TEXT NOT NULL,
  "source" TEXT,
  "status" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB,
  "result" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeadLetterJob" (
  "id" TEXT NOT NULL,
  "processingJobId" TEXT,
  "queueName" TEXT NOT NULL,
  "jobName" TEXT NOT NULL,
  "payload" JSONB,
  "error" TEXT NOT NULL,
  "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "replayedAt" TIMESTAMP(3),
  "replayedBy" TEXT,
  CONSTRAINT "DeadLetterJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Document_canonicalKey_key" ON "Document"("canonicalKey");
CREATE UNIQUE INDEX "Document_canonicalUrl_key" ON "Document"("canonicalUrl");
CREATE INDEX "Document_source_documentType_idx" ON "Document"("source", "documentType");
CREATE INDEX "Document_status_updatedAt_idx" ON "Document"("status", "updatedAt");

CREATE UNIQUE INDEX "DocumentVersion_documentId_contentHash_key" ON "DocumentVersion"("documentId", "contentHash");
CREATE INDEX "DocumentVersion_publishedAt_idx" ON "DocumentVersion"("publishedAt");
CREATE INDEX "DocumentVersion_sourceItemId_idx" ON "DocumentVersion"("sourceItemId");

CREATE INDEX "DocumentMetadata_key_normalizedValue_idx" ON "DocumentMetadata"("key", "normalizedValue");
CREATE INDEX "DocumentMetadata_documentId_key_idx" ON "DocumentMetadata"("documentId", "key");

CREATE UNIQUE INDEX "DocumentChunk_documentVersionId_chunkIndex_key" ON "DocumentChunk"("documentVersionId", "chunkIndex");
CREATE INDEX "DocumentChunk_documentVersionId_idx" ON "DocumentChunk"("documentVersionId");
CREATE INDEX "DocumentChunk_article_idx" ON "DocumentChunk"("article");

CREATE UNIQUE INDEX "Embedding_chunkId_model_key" ON "Embedding"("chunkId", "model");
CREATE INDEX "Embedding_model_idx" ON "Embedding"("model");
CREATE INDEX "Embedding_vector_idx" ON "Embedding" USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX "AlertRule_organizationId_enabled_idx" ON "AlertRule"("organizationId", "enabled");
CREATE INDEX "AlertRule_userId_idx" ON "AlertRule"("userId");

CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification"("organizationId", "createdAt");
CREATE INDEX "Notification_alertRuleId_idx" ON "Notification"("alertRuleId");
CREATE INDEX "Notification_status_channel_idx" ON "Notification"("status", "channel");

CREATE UNIQUE INDEX "ProcessingJob_queueName_jobId_key" ON "ProcessingJob"("queueName", "jobId");
CREATE INDEX "ProcessingJob_queueName_status_idx" ON "ProcessingJob"("queueName", "status");
CREATE INDEX "ProcessingJob_type_createdAt_idx" ON "ProcessingJob"("type", "createdAt");

CREATE UNIQUE INDEX "DeadLetterJob_processingJobId_key" ON "DeadLetterJob"("processingJobId");
CREATE INDEX "DeadLetterJob_queueName_failedAt_idx" ON "DeadLetterJob"("queueName", "failedAt");

CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentMetadata" ADD CONSTRAINT "DocumentMetadata_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "DocumentChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeadLetterJob" ADD CONSTRAINT "DeadLetterJob_processingJobId_fkey" FOREIGN KEY ("processingJobId") REFERENCES "ProcessingJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
