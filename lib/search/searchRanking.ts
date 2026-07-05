export type SearchResultItem = {
  item: any;
  score: number;
  matchType: 'text' | 'semantic' | 'hybrid';
  scoreBreakdown?: {
    text: number;
    semantic: number;
    filter: number;
    ai?: number;
  };
  matchedFields?: string[];
};

export function rankSearchResults(
  textItems: any[],
  semanticChunks: any[],
  versionItemMap: Map<string, string>,
  semanticItemMap: Map<string, any>,
  inputKeywords: string[],
  sortMode: string = 'relevance'
): SearchResultItem[] {
  const combinedMap = new Map<string, SearchResultItem>();

  // 1. Process Text Results
  textItems.forEach((item, index) => {
    // Base score based on index for text
    const textScore = 1.0 - (index * 0.01);
    
    // Boost score if keyword exactly matches title, entities, or AI fields
    let filterBoost = 0;
    let aiBoost = 0;
    const matchedFields: string[] = [];
    const ai = item.aiEnrichment || {};

    inputKeywords.forEach(kw => {
      const lowerKw = kw.toLowerCase();
      if (item.title && item.title.toLowerCase().includes(lowerKw)) {
        filterBoost += 0.2;
        matchedFields.push('title');
      }
      if (item.keywordsHit && item.keywordsHit.toLowerCase().includes(lowerKw)) {
        filterBoost += 0.3;
        matchedFields.push('keywordsHit');
      }
      if (item.summary && item.summary.toLowerCase().includes(lowerKw)) {
        filterBoost += 0.1;
        if (!matchedFields.includes('summary')) matchedFields.push('summary');
      }

      // Match against AI enrichment fields
      if (ai.matter && ai.matter.toLowerCase().includes(lowerKw)) {
        aiBoost += 0.1;
        matchedFields.push('aiMatter');
      }
      if (ai.authority && ai.authority.toLowerCase().includes(lowerKw)) {
        aiBoost += 0.2;
        matchedFields.push('aiAuthority');
      }
      if (ai.executiveSummary && ai.executiveSummary.toLowerCase().includes(lowerKw)) {
        aiBoost += 0.1;
        matchedFields.push('aiExecutiveSummary');
      }
      if (ai.explanation && ai.explanation.toLowerCase().includes(lowerKw)) {
        aiBoost += 0.1;
        matchedFields.push('aiExplanation');
      }

      if (Array.isArray(ai.entities)) {
        const hasEntity = ai.entities.some((e: string) => e.toLowerCase().includes(lowerKw));
        if (hasEntity) {
          aiBoost += 0.2;
          matchedFields.push('aiEntities');
        }
      }
      if (Array.isArray(ai.affectedSectors)) {
        const hasSector = ai.affectedSectors.some((s: string) => s.toLowerCase().includes(lowerKw));
        if (hasSector) {
          aiBoost += 0.2;
          matchedFields.push('aiAffectedSectors');
        }
      }
      if (Array.isArray(ai.keywords)) {
        const hasKeyword = ai.keywords.some((k: string) => k.toLowerCase().includes(lowerKw));
        if (hasKeyword) {
          aiBoost += 0.2;
          matchedFields.push('aiKeywords');
        }
      }
      if (Array.isArray(ai.relatedTopics)) {
        const hasTopic = ai.relatedTopics.some((t: string) => t.toLowerCase().includes(lowerKw));
        if (hasTopic) {
          aiBoost += 0.1;
          matchedFields.push('aiRelatedTopics');
        }
      }
    });

    combinedMap.set(item.id, {
      item,
      score: Number((textScore + filterBoost + aiBoost).toFixed(4)),
      matchType: 'text',
      scoreBreakdown: { text: textScore, semantic: 0, filter: filterBoost, ai: aiBoost },
      matchedFields: Array.from(new Set(matchedFields))
    });
  });

  // 2. Process Semantic Results
  semanticChunks.forEach((chunk) => {
    const sourceItemId = versionItemMap.get(chunk.documentVersionId);
    if (sourceItemId) {
      const item = semanticItemMap.get(sourceItemId);
      if (item) {
        const semanticScore = chunk.similarity;
        if (combinedMap.has(item.id)) {
          const existing = combinedMap.get(item.id)!;
          existing.score = Number((existing.score + semanticScore).toFixed(4));
          existing.matchType = 'hybrid';
          if (existing.scoreBreakdown) {
            existing.scoreBreakdown.semantic = semanticScore;
          }
        } else {
          combinedMap.set(item.id, {
            item,
            score: Number(semanticScore.toFixed(4)),
            matchType: 'semantic',
            scoreBreakdown: { text: 0, semantic: semanticScore, filter: 0, ai: 0 },
            matchedFields: []
          });
        }
      }
    }
  });

  // Convert to array
  const results = Array.from(combinedMap.values());

  // 3. Sort
  if (sortMode === 'date') {
    results.sort((a, b) => {
      const dateA = a.item.published ? new Date(a.item.published).getTime() : 0;
      const dateB = b.item.published ? new Date(b.item.published).getTime() : 0;
      return dateB - dateA;
    });
  } else if (sortMode === 'impact') {
    const impactScores: Record<string, number> = { 'alto': 3, 'medio': 2, 'bajo': 1 };
    results.sort((a, b) => {
      const impactA = impactScores[a.item.impacto?.toLowerCase()] || 0;
      const impactB = impactScores[b.item.impacto?.toLowerCase()] || 0;
      if (impactA !== impactB) return impactB - impactA;
      return b.score - a.score;
    });
  } else {
    // Default: relevance
    results.sort((a, b) => b.score - a.score);
  }

  return results;
}
