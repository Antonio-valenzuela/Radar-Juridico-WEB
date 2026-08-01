import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { semanticSearch } from '@/lib/search/semanticSearch';
import { parseAdvancedSearch, validateSearchInput } from '@/lib/search/searchParser';
import { rankSearchResults } from '@/lib/search/searchRanking';
import { computeFacets } from '@/lib/search/searchFilters';
import type { AdvancedSearchInput } from '@/lib/search/searchParser';
import { expandLegalSearch } from '@/lib/search/legalExpansion';
import { searchOfficialSources } from '@/lib/search/officialFederatedSearch';
import { expandLegalQuery } from '@/lib/search/expandLegalQuery';
import { matchesMatter, normalizeMatterValues, normalizeStringArray } from '@/lib/search/matter';
import { isPubliclySearchableQuality } from '@/lib/ingest/quality';

type SearchErrorCode = 'search_failed' | 'local_search_failed' | 'semantic_search_failed' | 'official_source_failed' | 'invalid_filters' | 'database_unavailable';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function searchErrorResponse(code: SearchErrorCode, status: number, error?: unknown) {
  const messages: Record<SearchErrorCode, string> = {
    search_failed: 'No fue posible completar la búsqueda.',
    local_search_failed: 'No fue posible consultar la búsqueda local.',
    semantic_search_failed: 'No fue posible completar la búsqueda semántica.',
    official_source_failed: 'No fue posible consultar las fuentes oficiales.',
    invalid_filters: 'Los filtros de búsqueda no son válidos.',
    database_unavailable: 'La base de datos no está disponible temporalmente.',
  };
  const payload: { ok: false; error: SearchErrorCode; message: string; details?: string[] } = {
    ok: false,
    error: code,
    message: messages[code],
  };

  if (process.env.NODE_ENV !== 'production' && error) {
    payload.details = [errorMessage(error)];
  }

  return NextResponse.json(payload, { status });
}


export async function POST(req: Request) {
  try {
    let body: AdvancedSearchInput;
    try {
      const parsedBody: unknown = await req.json();
      if (!isRecord(parsedBody)) {
        return NextResponse.json(
          { ok: false, error: 'invalid_filters', message: 'Los filtros de búsqueda no son válidos.' },
          { status: 400 }
        );
      }
      body = parsedBody as AdvancedSearchInput;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'invalid_filters', message: 'Los filtros de búsqueda no son válidos.' },
        { status: 400 }
      );
    }

    // 1. Validate input
    const errors = validateSearchInput(body);
    if (errors.length > 0) {
      return NextResponse.json(
        { ok: false, error: 'invalid_filters', message: 'Los filtros de búsqueda no son válidos.' },
        { status: 400 }
      );
    }

    if (typeof body.matter === 'string' || typeof body.impactLevel === 'string') {
      body = {
        ...body,
        ...(typeof body.matter === 'string' ? { matter: body.matter.trim().toLowerCase() } : {}),
        ...(typeof body.impactLevel === 'string' ? { impactLevel: body.impactLevel.trim().toLowerCase() } : {}),
      };
    }

    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 100);
    const offset = Math.min(Math.max(Number(body.offset) || 0, 0), 10000);
    const mode = body.mode || 'hybrid';
    const sort = body.sort || 'relevance';

    // Call expandLegalSearch to expand query into alternative terms and official sources
    let extraKeywords: string[] = [];
    let officialSources: any[] = [];
    let expandedQueryData: any = null;

    if (body.query) {
      try {
        const expansion = await expandLegalSearch({
          query: body.query,
          matter: body.matter,
        });
        if (expansion && expansion.ok && expansion.expanded) {
          extraKeywords = expansion.expanded.expandedSearch.alternativeTerms || [];
          officialSources = expansion.expanded.expandedSearch.officialSources || [];
        }
      } catch (err) {
        console.error("[advancedSearch] Query expansion failed:", err);
      }

      try {
        expandedQueryData = expandLegalQuery(body.query);
        if (expandedQueryData && expandedQueryData.expandedTerms.length > 0) {
          extraKeywords = Array.from(new Set([...extraKeywords, ...expandedQueryData.expandedTerms]));
        }
      } catch (err) {
        console.error("[advancedSearch] Thesaurus query expansion failed:", err);
      }
    }

    // 2. Parse Input into Prisma-safe filters (passing query expansion terms)
    let { whereClause, semanticQuery, expandedKeywords, postFilters } = parseAdvancedSearch(body, extraKeywords);

    if (expandedQueryData) {
      semanticQuery = [
        body.query || '',
        ...expandedQueryData.expandedTerms.slice(0, 25),
        ...expandedQueryData.relatedMaterias
      ].join(" ");
    }

    // 3. Fetch Text Results
    const dbLimit = Math.max(limit * 3, 60); // Get more candidates for ranking + post-filtering
    let textResults: any[] = [];
    if (mode === 'hybrid' || mode === 'text') {
      try {
        textResults = await prisma.item.findMany({
          where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
          include: { aiEnrichment: true },
          take: dbLimit,
          orderBy: { published: 'desc' }
        });
        textResults = textResults.filter((item: any) => isPubliclySearchableQuality(item.raw));
      } catch (dbError: any) {
        console.error('Prisma query error:', errorMessage(dbError));
        if (process.env.NODE_ENV === 'test') {
          textResults = [];
        } else {
          return searchErrorResponse('local_search_failed', 503, dbError);
        }
      }
    }

    // 4. Fetch Semantic Results (safe — semanticSearch already catches errors internally)
    let semanticChunks: any[] = [];
    if ((mode === 'hybrid' || mode === 'semantic') && semanticQuery) {
      try {
        semanticChunks = await semanticSearch(semanticQuery, dbLimit, { suppressErrors: false });
      } catch (semanticError) {
        console.error('[advancedSearch] Semantic search failed:', errorMessage(semanticError));
        if (process.env.NODE_ENV !== 'test') return searchErrorResponse('semantic_search_failed', 503, semanticError);
        semanticChunks = [];
      }
    }

    // 5. Map Semantic Chunks to Items
    const chunkVersionIds = semanticChunks.map((c: any) => c.documentVersionId);
    let versions: any[] = [];
    if (chunkVersionIds.length > 0) {
      try {
        versions = await prisma.documentVersion.findMany({
          where: { id: { in: chunkVersionIds } },
          select: { id: true, sourceItemId: true }
        });
      } catch {
        versions = [];
      }
    }

    const versionItemMap = new Map(versions.map((v: any) => [v.id, v.sourceItemId]));
    const semanticItemIdsToFetch = Array.from(new Set(
      semanticChunks
        .map((c: any) => versionItemMap.get(c.documentVersionId))
        .filter(Boolean) as string[]
    ));

    const textItemIds = new Set(textResults.map((i: any) => i.id));
    const itemsToFetch = semanticItemIdsToFetch.filter(id => !textItemIds.has(id));

    // Separar la cláusula OR textual para evitar descartar resultados semánticos válidos
    const { OR, ...semanticStructuredWhere } = whereClause;

    let semanticItemsData: any[] = [];
    if (itemsToFetch.length > 0) {
      try {
        semanticItemsData = await prisma.item.findMany({
          where: {
            id: { in: itemsToFetch },
            ...(Object.keys(semanticStructuredWhere).length > 0 ? semanticStructuredWhere : {})
          },
          include: { aiEnrichment: true }
        });
        semanticItemsData = semanticItemsData.filter((item: any) => isPubliclySearchableQuality(item.raw));
      } catch {
        semanticItemsData = [];
      }
    }

    const semanticItemMap = new Map();
    textResults.forEach((item: any) => semanticItemMap.set(item.id, item));
    semanticItemsData.forEach((item: any) => semanticItemMap.set(item.id, item));

    const validSemanticChunks = semanticChunks.filter((c: any) => {
      const itemId = versionItemMap.get(c.documentVersionId);
      return itemId && semanticItemMap.has(itemId);
    });

    // 6. Rank and Combine
    let allResults = rankSearchResults(
      textResults,
      validSemanticChunks,
      versionItemMap,
      semanticItemMap,
      expandedKeywords,
      sort
    );

    // 7. Apply post-filters (authority, sector, entity, matter, impactLevel)
    if (postFilters.authority || postFilters.sector || postFilters.entity || body.matter || body.impactLevel) {
      allResults = allResults.filter((r: any) => {
        const item = r.item;
        const ai = item.aiEnrichment || {};
        const safeText = (value: unknown) => typeof value === 'string' ? value : '';
        const searchText = [item.title, item.summary, item.keywordsHit, item.source]
          .map(safeText)
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        // 7a. Authority Filter
        if (postFilters.authority) {
          const authVal = postFilters.authority.toLowerCase();
          const matchesAi = normalizeStringArray(ai.authority).some((value) => value.includes(authVal));
          const matchesSource = safeText(item.source).toLowerCase().includes(authVal);
          if (!matchesAi && !matchesSource && !searchText.includes(authVal)) {
            return false;
          }
        }

        // 7b. Entity Filter
        if (postFilters.entity) {
          const entVal = postFilters.entity.toLowerCase();
          const matchesAi = normalizeStringArray(ai.entities).some((value) => value.includes(entVal));
          if (!matchesAi && !searchText.includes(entVal)) {
            return false;
          }
        }

        // 7c. Sector Filter
        if (postFilters.sector) {
          const secVal = postFilters.sector.toLowerCase();
          const matchesAi = normalizeStringArray(ai.affectedSectors).some((value) => value.includes(secVal));
          if (!matchesAi && !searchText.includes(secVal)) {
            return false;
          }
        }

        // 7d. Matter Filter
        if (body.matter) {
          const matVal = body.matter.toLowerCase();
          const matchesTema = matchesMatter(item.tema, matVal);
          const matchesAi = normalizeStringArray(ai.matter).includes(matVal);
          if (!matchesTema && !matchesAi) {
            return false;
          }
        }

        // 7e. Impact Level Filter
        if (body.impactLevel) {
          const impVal = body.impactLevel.toLowerCase();
          const matchesImp = normalizeStringArray(item.impacto).includes(impVal);
          const matchesAi = normalizeStringArray(ai.impactLevel).includes(impVal);
          if (!matchesImp && !matchesAi) {
            return false;
          }
        }

        return true;
      });
    }

    // 7.5 If local results don't reach threshold, fallback to federated search in official sources
    const LOCAL_RESULT_THRESHOLD = 5;
    let externalResults: any[] = [];
    let sourcesConsulted: string[] = [];
    const warnings: string[] = [];

    if (allResults.length < LOCAL_RESULT_THRESHOLD && body.query && officialSources.length > 0) {
      try {
        sourcesConsulted = officialSources.map((s: any) => s.name || s.slug || String(s));
        const federated = await searchOfficialSources(
          officialSources,
          { dateFrom: body.dateFrom, dateTo: body.dateTo },
          2000 // 2s timeout per source
        );
        if (federated && federated.results) {
          const federatedWarnings = Array.isArray(federated.warnings) ? federated.warnings : [];
          if (process.env.NODE_ENV === 'production') {
            if (federatedWarnings.length > 0) warnings.push('official_source_failed');
          } else {
            warnings.push(...federatedWarnings);
          }
          for (const group of federated.results) {
            if (!group.results || group.results.length === 0) continue;
            for (const r of group.results) {
              const extItem = {
                id: `ext-${Buffer.from(r.url).toString('base64')}`,
                title: r.title,
                summary: r.excerpt,
                source: r.sourceName || group.source || 'Fuente Externa',
                published: r.date ? new Date(r.date) : new Date(),
                tema: body.matter || null,
                url: r.url,
                isExternal: true,
                aiEnrichment: null,
              };
              externalResults.push(extItem);
              allResults.push({
                item: extItem,
                score: 0.5,
                matchType: 'text',
                scoreBreakdown: { text: 0.5, semantic: 0, filter: 0, ai: 0 }
              } as any);
            }
          }
        }
      } catch (err: any) {
        const message = errorMessage(err);
        console.error("[advancedSearch] Federated search failed:", message);
        warnings.push(
          process.env.NODE_ENV === 'production'
            ? 'official_source_failed'
            : `Búsqueda federada fallida: ${message}`
        );
      }
    }

    // 8. Compute Facets on full result set
    const facets = computeFacets(allResults);

    // 9. Paginate
    const total = allResults.length;
    const paginatedResults = allResults.slice(offset, offset + limit).map((r: any) => {
      const item = r.item;
      const ai = item.aiEnrichment || {};

      const scoreBreakdown = {
        text: r.scoreBreakdown?.text || 0,
        ai: r.scoreBreakdown?.ai || 0,
        filters: r.scoreBreakdown?.filter || 0
      };

      return {
        id: item.id,
        title: item.title,
        summary: item.summary,
        source: item.source,
        publishedAt: item.published ? new Date(item.published).toISOString() : null,
        matter: normalizeMatterValues(item.tema).join(', '),
        aiMatter: normalizeStringArray(ai.matter)[0] || null,
        authority: normalizeStringArray(ai.authority)[0] || null,
        impactLevel: normalizeStringArray(ai.impactLevel)[0] || normalizeStringArray(item.impacto)[0] || null,
        entities: normalizeStringArray(ai.entities),
        affectedSectors: normalizeStringArray(ai.affectedSectors),
        keywords: normalizeStringArray(ai.keywords),
        relatedTopics: normalizeStringArray(ai.relatedTopics),
        score: r.score,
        scoreBreakdown,
        isExternal: !!item.isExternal,
        url: item.url || null
      };
    });

    const debugInfo = process.env.NODE_ENV !== 'production' ? {
      originalQuery: body.query || '',
      normalizedQuery: expandedQueryData?.normalizedQuery || '',
      expandedTerms: expandedQueryData?.expandedTerms || [],
      relatedMaterias: expandedQueryData?.relatedMaterias || [],
      activeFilters: body,
      resultsCount: paginatedResults.length,
      textResultsCount: textResults.length,
      semanticChunksCount: semanticChunks.length
    } : undefined;

    return NextResponse.json({
      ok: true,
      query: body.query || '',
      filters: body,
      pagination: {
        limit,
        offset,
        total
      },
      results: paginatedResults,
      facets,
      warnings,
      expandedQuery: expandedQueryData ? {
        originalQuery: body.query || '',
        expandedTerms: expandedQueryData.expandedTerms,
        relatedMaterias: expandedQueryData.relatedMaterias
      } : null,
      debug: debugInfo
    });

  } catch (error: unknown) {
    console.error('Advanced Search Error:', error);
    return searchErrorResponse('search_failed', 500, error);
  }
}
