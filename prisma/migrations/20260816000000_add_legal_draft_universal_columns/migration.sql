-- AddUniversalColumnsToLegalDraft
-- Columnas para el motor universal de documentos (escrito completo, editor, RAG local).
ALTER TABLE "LegalDraft" ADD COLUMN "structuredDoc" JSONB,
ADD COLUMN "pipelineState" JSONB,
ADD COLUMN "sourceDocuments" JSONB,
ADD COLUMN "validationResults" JSONB,
ADD COLUMN "generationMetadata" JSONB;