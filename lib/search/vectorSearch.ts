import { prisma } from "../prisma";
import { generateNVIDIAEmbedding } from "../ai/providers/nvidiaEmbeddings";

export interface VectorSearchResult {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  similarity: number;
}

export async function searchVectorChunks(
  query: string,
  limit: number = 5
): Promise<VectorSearchResult[]> {
  try {
    const [queryVector] = await generateNVIDIAEmbedding(query, "query");
    if (!queryVector || queryVector.length === 0) return [];

    const vectorString = `[${queryVector.join(",")}]`;

    // Consulta vectorial nativa en PostgreSQL / Neon con extensión pgvector
    const results: Array<{
      id: string;
      documentId: string;
      chunkIndex: number;
      text: string;
      similarity: number | string;
    }> = await prisma.$queryRaw`
      SELECT 
        dc.id,
        dc."documentId",
        dc."chunkIndex",
        dc.text,
        1 - (e.vector <=> ${vectorString}::vector) AS similarity
      FROM "DocumentChunk" dc
      JOIN "Embedding" e ON e."chunkId" = dc.id
      ORDER BY e.vector <=> ${vectorString}::vector ASC
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      id: r.id,
      documentId: r.documentId,
      chunkIndex: r.chunkIndex,
      text: r.text,
      similarity: Number(r.similarity) || 0,
    }));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn("[VectorSearch] Advertencia al ejecutar consulta pgvector:", msg);
    return [];
  }
}
