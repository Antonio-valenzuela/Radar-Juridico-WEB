import { prisma } from "../prisma";
import { generateNVIDIAEmbedding } from "../ai/providers/nvidiaEmbeddings";

export interface VectorSearchResult {
  id: string;
  documentVersionId: string;
  chunkIndex: number;
  text: string;
  similarity: number;
}

/**
 * Búsqueda vectorial por similitud coseno con pgvector.
 * Vectoriza la consulta con NVIDIA Embeddings (fallback local si no hay API key).
 * Retorna [] si pgvector no está disponible o la búsqueda falla.
 */
export async function searchVectorChunks(
  query: string,
  limit: number = 5
): Promise<VectorSearchResult[]> {
  try {
    const [queryVector] = await generateNVIDIAEmbedding(query, "query");
    if (!queryVector || queryVector.length === 0) return [];

    const vectorString = `[${queryVector.join(",")}]`;

    // Búsqueda vectorial nativa con pgvector — columna correcta es "embedding"
    const results: Array<{
      id: string;
      documentVersionId: string;
      chunkIndex: number;
      text: string;
      similarity: number | string;
    }> = await prisma.$queryRaw`
      SELECT 
        dc.id,
        dc."documentVersionId",
        dc."chunkIndex",
        dc.text,
        1 - (e.embedding <=> ${vectorString}::vector) AS similarity
      FROM "DocumentChunk" dc
      JOIN "Embedding" e ON e."chunkId" = dc.id
      WHERE e.embedding IS NOT NULL
      ORDER BY e.embedding <=> ${vectorString}::vector ASC
      LIMIT ${limit}
    `;

    return results.map((r) => ({
      id: r.id,
      documentVersionId: r.documentVersionId,
      chunkIndex: r.chunkIndex,
      text: r.text,
      similarity: Number(r.similarity) || 0,
    }));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn("[VectorSearch] Error en búsqueda pgvector:", msg);
    return [];
  }
}
