import { prisma } from "@/lib/prisma";
import { analyzeLegalDocumentWithProvider } from "@/lib/ai/provider";
import { ItemAiEnrichmentData } from "./enrichmentTypes";

/**
 * Enriches a single Item in the database with AI metadata.
 * Uses the configured AI provider, falling back to the local provider if it fails.
 */
export async function enrichItem(itemId: string): Promise<{
  ok: boolean;
  itemId: string;
  enrichment?: ItemAiEnrichmentData;
  error?: string;
}> {
  try {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return { ok: false, itemId, error: "Item not found" };
    }

    const rawObj =
      item.raw && typeof item.raw === "object" && !Array.isArray(item.raw)
        ? (item.raw as Record<string, unknown>)
        : {};

    const text =
      (rawObj.text ||
        rawObj.content ||
        rawObj.body ||
        rawObj.contenido ||
        item.summary ||
        item.title) as string;

    // Call the active AI provider
    const { provider, analysis } = await analyzeLegalDocumentWithProvider({
      title: item.title,
      summary: item.summary,
      text: text,
      sourceUrl: item.canonicalUrl || item.url,
      publishedAt: item.published,
    });

    // Make sure we apply rule safety:
    // If the authority is not clear, put null or "No identificada"
    // (Our types already handle clean sanitization, but let's make sure)
    const authority = analysis.authority ? analysis.authority.trim() : null;

    const enrichmentData = {
      matter: analysis.matter,
      authority: authority || null,
      entities: analysis.entities,
      affectedSectors: analysis.affectedSectors,
      keywords: analysis.keywords,
      relatedTopics: analysis.relatedTopics,
      impactLevel: analysis.impactLevel,
      executiveSummary: analysis.summary,
      explanation: analysis.explanation,
      provider: provider,
      confidence: analysis.confidence,
    };

    // Upsert into ItemAiEnrichment
    await prisma.itemAiEnrichment.upsert({
      where: { itemId: item.id },
      create: {
        itemId: item.id,
        matter: enrichmentData.matter,
        authority: enrichmentData.authority,
        entities: enrichmentData.entities,
        affectedSectors: enrichmentData.affectedSectors,
        keywords: enrichmentData.keywords,
        relatedTopics: enrichmentData.relatedTopics,
        impactLevel: enrichmentData.impactLevel,
        executiveSummary: enrichmentData.executiveSummary,
        explanation: enrichmentData.explanation,
        provider: enrichmentData.provider,
        confidence: enrichmentData.confidence,
      },
      update: {
        matter: enrichmentData.matter,
        authority: enrichmentData.authority,
        entities: enrichmentData.entities,
        affectedSectors: enrichmentData.affectedSectors,
        keywords: enrichmentData.keywords,
        relatedTopics: enrichmentData.relatedTopics,
        impactLevel: enrichmentData.impactLevel,
        executiveSummary: enrichmentData.executiveSummary,
        explanation: enrichmentData.explanation,
        provider: enrichmentData.provider,
        confidence: enrichmentData.confidence,
      },
    });

    return {
      ok: true,
      itemId: item.id,
      enrichment: enrichmentData,
    };
  } catch (error) {
    return {
      ok: false,
      itemId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
