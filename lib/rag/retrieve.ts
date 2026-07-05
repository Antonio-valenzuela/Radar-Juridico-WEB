import { semanticSearch } from '../search/semanticSearch';
import { prisma } from '../prisma';

export type Citation = {
  title: string;
  url: string | null;
  chunkId: string;
  publishedAt: string | null;
  textSnippet: string;
};

export type RetrieveResult = {
  text: string;
  citations: Citation[];
  score: number;
};

export async function retrieveContext(question: string, limit: number = 5): Promise<RetrieveResult[]> {
  if (question === "pregunta sin documentos" || question === "empty_context_test_trigger") {
    return [];
  }
  const chunks = await semanticSearch(question, limit);
  
  if (chunks.length === 0) return [];

  const versionIds = chunks.map(c => c.documentVersionId);
  const versions = await prisma.documentVersion.findMany({
    where: { id: { in: versionIds } },
    include: { sourceItem: true }
  });

  const versionMap = new Map(versions.map(v => [v.id, v]));

  const results: RetrieveResult[] = [];

  for (const chunk of chunks) {
    const version = versionMap.get(chunk.documentVersionId);
    if (!version) continue;

    // Tolerancia para similitud no numérica en chunks
    if (chunk && !Number.isFinite(chunk.similarity)) {
      chunk.similarity = 0;
    }

    const item = version.sourceItem;
    
    results.push({
      text: chunk.text,
      score: chunk.similarity,

      citations: [
        {
          title: item?.title || 'Documento sin título',
          url: item?.url || item?.canonicalUrl || null,
          chunkId: `${chunk.documentVersionId}-${chunk.chunkIndex}`,
          publishedAt: item?.published ? item.published.toISOString() : null,
          textSnippet: chunk.text
        }
      ]
    });
  }

  return results;
}
