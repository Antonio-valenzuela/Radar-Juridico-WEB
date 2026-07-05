import { prisma } from '../prisma';
import { generateEmbedding } from '../ai/embeddings';

export type SemanticSearchResult = {
  documentVersionId: string;
  chunkIndex: number;
  text: string;
  article: string | null;
  similarity: number;
};

export async function semanticSearch(
  query: string,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  try {
    const { embedding } = await generateEmbedding(query);
    
    // We format the array to pgvector string format: '[1.0, 2.0, ...]'
    const embeddingStr = `[${embedding.join(',')}]`;

    // Perform vector search using cosine distance (<=>)
    const results = await prisma.$queryRaw<SemanticSearchResult[]>`
      SELECT 
        c."documentVersionId", 
        c."chunkIndex", 
        c."text", 
        c."article",
        1 - (e.embedding <=> ${embeddingStr}::vector) as similarity
      FROM "DocumentChunk" c
      JOIN "Embedding" e ON e."chunkId" = c.id
      ORDER BY e.embedding <=> ${embeddingStr}::vector
      LIMIT ${limit};
    `;

    return results;
  } catch (error) {
    console.error('Error in semantic search:', error);
    // Return empty results if there's an issue (e.g. extension not available yet or no keys)
    return [];
  }
}
