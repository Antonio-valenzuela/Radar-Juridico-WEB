// lib/search/hybridSearch.ts

import { prisma } from '@/lib/prisma';
import { semanticSearch } from './semanticSearch';
import { expandLegalQuery } from './expandLegalQuery';

export interface SearchFilters {
  fuente?: string[];
  materia?: string[];
  tipo?: string[];
  fecha_desde?: Date | string;
  fecha_hasta?: Date | string;
  confianza?: string;
  impacto?: string;
  startDate?: Date | string;
  endDate?: Date | string;
}

export interface HybridSearchResult {
  documento: string;
  coincidencia_semantica: number;
  coincidencia_textual: number;
  fuente: string;
  fragmento_relevante: string;
  fecha: string;
  item?: any;
  score?: number;
}

export async function hybridSearch(
  queryOrParams: string | { query: string; filters?: SearchFilters; limit?: number },
  filtersOrNull?: SearchFilters,
  limitOrNull?: number
): Promise<HybridSearchResult[]> {
  let query: string;
  let filters: SearchFilters = {};
  let limit = 10;

  if (typeof queryOrParams === 'object' && queryOrParams !== null) {
    query = queryOrParams.query;
    if (queryOrParams.filters) {
      filters = queryOrParams.filters;
    }
    limit = queryOrParams.limit ?? 10;
  } else {
    query = queryOrParams;
    filters = filtersOrNull || {};
    limit = limitOrNull ?? 10;
  }
  const cleanQuery = (query || '').trim();
  const expanded = expandLegalQuery(cleanQuery);

  // 1. Búsqueda de texto completo en PostgreSQL (Documentos)
  const textWhere: any = {};
  
  if (cleanQuery) {
    const searchTerms = Array.from(new Set([cleanQuery, ...expanded.expandedTerms]));
    textWhere.OR = [];
    for (const term of searchTerms) {
      textWhere.OR.push({ title: { contains: term, mode: 'insensitive' } });
      textWhere.OR.push({ summary: { contains: term, mode: 'insensitive' } });
    }
  }

  // Aplicar filtros en la query a Documentos
  if (filters.fuente && filters.fuente.length > 0) {
    textWhere.source = { in: filters.fuente };
  }
  if (filters.tipo && filters.tipo.length > 0) {
    textWhere.documentType = { in: filters.tipo };
  }

  const textDocuments = await prisma.document.findMany({
    where: textWhere,
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        include: { sourceItem: true }
      }
    },
    take: limit * 2, // traemos un excedente para poder cruzar y filtrar
  });

  // 2. Búsqueda semántica usando pgvector
  let semanticChunks: any[] = [];
  if (cleanQuery) {
    const semanticQuery = [
      cleanQuery,
      ...expanded.expandedTerms.slice(0, 25),
      ...expanded.relatedMaterias
    ].join(" ");
    semanticChunks = await semanticSearch(semanticQuery, limit * 2);
  }

  // Mapear chunks a Documentos (batch query en vez de N+1)
  const semanticDocMap = new Map<string, { similarity: number; text: string }>();
  
  const chunkVersionIds = semanticChunks.map((chunk: any) => chunk.documentVersionId).filter(Boolean);
  let versionToDocMap = new Map<string, string>();
  
  if (chunkVersionIds.length > 0) {
    const versions = await prisma.documentVersion.findMany({
      where: { id: { in: chunkVersionIds } },
      select: { id: true, documentId: true }
    });
    versionToDocMap = new Map(versions.map(v => [v.id, v.documentId]));
  }
  
  for (const chunk of semanticChunks) {
    const docId = versionToDocMap.get(chunk.documentVersionId);
    if (docId) {
      const existing = semanticDocMap.get(docId);
      if (!existing || chunk.similarity > existing.similarity) {
        semanticDocMap.set(docId, {
          similarity: chunk.similarity,
          text: chunk.text
        });
      }
    }
  }

  // 3. Combinar resultados (Hybrid Scoring)
  const combinedMap = new Map<string, {
    doc: any;
    textScore: number;
    semScore: number;
    fragment: string;
  }>();

  // Agregar resultados textuales
  textDocuments.forEach((doc, idx) => {
    // Cálculo de score textual aproximado (0-100)
    let score = 50; // Base score por aparecer en la query
    if (cleanQuery) {
      const titleLower = doc.title.toLowerCase();
      const qLower = cleanQuery.toLowerCase();
      if (titleLower.includes(qLower)) score += 30;
      if (doc.summary?.toLowerCase().includes(qLower)) score += 20;
    }
    // Penalizar ligeramente según la posición en los resultados de la consulta de base de datos
    score = Math.max(0, Math.min(100, Math.round(score - idx * 2)));

    combinedMap.set(doc.id, {
      doc,
      textScore: score,
      semScore: 0,
      fragment: doc.summary || doc.title
    });
  });

  // Integrar resultados semánticos
  // Primero, recopilar los IDs de documentos que no están en combinedMap
  const missingDocIds: string[] = [];
  for (const [docId, semData] of semanticDocMap.entries()) {
    if (combinedMap.has(docId)) {
      const entry = combinedMap.get(docId)!;
      const semScore = Math.max(0, Math.min(100, Math.round(semData.similarity * 100)));
      entry.semScore = semScore;
      entry.fragment = semData.text;
    } else {
      missingDocIds.push(docId);
    }
  }

  // Batch fetch de documentos faltantes
  if (missingDocIds.length > 0) {
    const missingDocs = await prisma.document.findMany({
      where: { id: { in: missingDocIds } },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: { sourceItem: true }
        }
      }
    });

    for (const doc of missingDocs) {
      const semData = semanticDocMap.get(doc.id);
      if (!semData) continue;
      const semScore = Math.max(0, Math.min(100, Math.round(semData.similarity * 100)));

      // Validar filtros de base en los resultados semánticos puros
      let matchFilters = true;
      if (filters.fuente && filters.fuente.length > 0 && !filters.fuente.includes(doc.source)) {
        matchFilters = false;
      }
      if (filters.tipo && filters.tipo.length > 0 && !filters.tipo.includes(doc.documentType)) {
        matchFilters = false;
      }

      if (matchFilters) {
        combinedMap.set(doc.id, {
          doc,
          textScore: 0,
          semScore,
          fragment: semData.text
        });
      }
    }
  }

  // 4. Aplicar filtros más complejos (materia, fecha, confianza, impacto) y ordenar por score híbrido
  const finalResults: HybridSearchResult[] = [];
  const fromDate = filters.fecha_desde
    ? new Date(filters.fecha_desde)
    : filters.startDate
    ? new Date(filters.startDate)
    : null;
  const toDate = filters.fecha_hasta
    ? new Date(filters.fecha_hasta)
    : filters.endDate
    ? new Date(filters.endDate)
    : null;

  for (const entry of combinedMap.values()) {
    const { doc, textScore, semScore, fragment } = entry;
    const latestVersion = doc.versions[0];
    const sourceItem = latestVersion?.sourceItem;

    // A. Filtrar por materia
    if (filters.materia && filters.materia.length > 0) {
      const itemMatter = sourceItem?.tema;
      if (!itemMatter || !filters.materia.map(m => m.toLowerCase()).includes(itemMatter.toLowerCase())) {
        continue;
      }
    }

    // B. Filtrar por fechas de publicación
    const pubDate = latestVersion?.publishedAt || doc.updatedAt;
    if (fromDate && pubDate < fromDate) continue;
    if (toDate && pubDate > toDate) continue;

    // C. Filtrar por nivel de confianza (si aplica)
    if (filters.confianza) {
      if (filters.confianza === 'oficial' && doc.source !== 'DOF' && doc.source !== 'SCJN') {
        continue;
      }
    }

    // D. Filtrar por impacto
    if (filters.impacto) {
      const itemImpact = sourceItem?.impacto;
      if (!itemImpact || itemImpact.toLowerCase() !== filters.impacto.toLowerCase()) {
        continue;
      }
    }

    // Calcular score híbrido para el ordenamiento final
    const hybridScore = (textScore * 0.4) + (semScore * 0.6);

    finalResults.push({
      documento: doc.title,
      coincidencia_semantica: semScore,
      coincidencia_textual: textScore,
      fuente: doc.source,
      fragmento_relevante: fragment ? (fragment.length > 300 ? fragment.slice(0, 300) + '...' : fragment) : 'Sin fragmento disponible',
      fecha: pubDate.toISOString().slice(0, 10),
      item: sourceItem || {
        id: doc.id,
        title: doc.title,
        source: doc.source,
        url: doc.canonicalUrl || "",
        published: pubDate,
        summary: doc.summary,
        tipo: doc.documentType,
        tema: null,
      },
      score: hybridScore / 100,
      // Atributo temporal para ordenar
      _score: hybridScore
    } as any);
  }

  // Ordenar de mayor a menor relevancia
  return (finalResults as any[])
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(r => {
      const { _score, ...rest } = r;
      return rest;
    });
}
