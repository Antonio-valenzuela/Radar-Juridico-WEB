import { Job } from 'bullmq';
import { indexDocumentVersion } from '../lib/documents/indexDocument';

/**
 * Processor for the embeddings queue.
 * Extracts the documentVersionId from the job and indexes the document.
 */
export async function processEmbeddingJob(job: Job) {
  const documentVersionId = job.data?.documentVersionId;
  
  if (!documentVersionId) {
    throw new Error('documentVersionId is required for embedding job');
  }

  console.log(`Processing embedding job for DocumentVersion: ${documentVersionId}`);
  
  const result = await indexDocumentVersion(documentVersionId);
  
  return {
    ok: true,
    queue: 'embeddings',
    job: job.name,
    documentVersionId,
    chunksIndexed: result.chunks,
    skipped: result.skipped
  };
}
