import { prisma } from '../prisma';
import { chunkText } from './chunking';
import { generateEmbedding } from '../ai/embeddings';

/**
 * Indexes a document version by chunking its text and generating embeddings.
 */
export async function indexDocumentVersion(documentVersionId: string) {
  // 1. Check if already indexed by looking for chunks
  const existingChunks = await prisma.documentChunk.count({
    where: { documentVersionId }
  });

  if (existingChunks > 0) {
    console.log(`DocumentVersion ${documentVersionId} already indexed. Skipping.`);
    return { ok: true, chunks: existingChunks, skipped: true };
  }

  // 2. Fetch the document text
  const docVersion = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    select: { rawText: true, contentHash: true }
  });

  if (!docVersion) {
    throw new Error(`DocumentVersion ${documentVersionId} not found.`);
  }

  if (!docVersion.rawText) {
    console.log(`DocumentVersion ${documentVersionId} has no rawText to index.`);
    return { ok: true, chunks: 0, skipped: true };
  }

  // 3. Chunk the text
  const chunks = chunkText(docVersion.rawText);

  if (chunks.length === 0) {
    return { ok: true, chunks: 0, skipped: true };
  }

  console.log(`Generating embeddings for ${chunks.length} chunks of DocumentVersion ${documentVersionId}...`);

  // 4. Generate embeddings and save sequentially or in batches
  // Doing it sequentially to avoid rate limits if using external API
  let savedCount = 0;
  for (const chunk of chunks) {
    try {
      const { embedding, model } = await generateEmbedding(chunk.text);
      
      // Save chunk and embedding in a transaction
      await prisma.$transaction(async (tx) => {
        const createdChunk = await tx.documentChunk.create({
          data: {
            documentVersionId,
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            tokenCount: chunk.text.length / 4, // rough estimate
          }
        });

        // Insert embedding using raw query for pgvector
        const embeddingStr = `[${embedding.join(',')}]`;
        await tx.$executeRaw`
          INSERT INTO "Embedding" ("id", "chunkId", "model", "embedding", "createdAt")
          VALUES (gen_random_uuid(), ${createdChunk.id}, ${model}, ${embeddingStr}::vector, NOW())
        `;
      });
      savedCount++;
    } catch (err) {
      console.error(`Failed to index chunk ${chunk.chunkIndex} for doc ${documentVersionId}:`, err);
    }
  }

  return { ok: true, chunks: savedCount, skipped: false };
}
