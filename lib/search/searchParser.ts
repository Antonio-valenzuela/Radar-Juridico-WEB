/**
 * Advanced Search Parser for Juridico Radar.
 * 
 * CRITICAL: Only uses fields that exist on the Prisma Item model:
 *   source, sourceId, title, url, published, summary, impacto, tipo, tema, category, keywordsHit
 * 
 * Fields that DO NOT exist on Item and must NOT be used in whereClause:
 *   authority, affectedSectors, entities
 * 
 * Those filters are applied as post-query text matching instead.
 */

import { getTaskById } from '../tasks/taskTaxonomy';

export type AdvancedSearchInput = {
  query?: string;
  exact?: string;
  matter?: string;
  source?: string;
  authority?: string;   // NOT a Prisma field — applied as text filter
  impactLevel?: string;
  sector?: string;      // NOT a Prisma field — applied as text filter
  entity?: string;      // NOT a Prisma field — applied as text filter
  dateFrom?: string;
  dateTo?: string;
  task?: string;
  watchlistId?: string;
  mode?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  tipo?: string;
};

export type ParsedFilters = {
  whereClause: Record<string, unknown>;
  semanticQuery: string;
  expandedKeywords: string[];
  postFilters: {
    authority?: string;
    sector?: string;
    entity?: string;
  };
};

const VALID_MODES = ['text', 'semantic', 'hybrid'];
const VALID_SORTS = ['relevance', 'date', 'impact'];
const MAX_STRING_LEN = 200;
const MAX_QUERY_LEN = 500;

export type ValidationError = {
  field: string;
  message: string;
};

/**
 * Validates the input payload and returns a list of errors, or empty array if valid.
 */
export function validateSearchInput(input: AdvancedSearchInput): ValidationError[] {
  const errors: ValidationError[] = [];

  // limit
  if (input.limit !== undefined) {
    const n = Number(input.limit);
    if (isNaN(n) || n < 1 || n > 100) {
      errors.push({ field: 'limit', message: 'limit debe ser un número entre 1 y 100' });
    }
  }

  // offset
  if (input.offset !== undefined) {
    const n = Number(input.offset);
    if (isNaN(n) || n < 0 || n > 10000) {
      errors.push({ field: 'offset', message: 'offset debe ser un número entre 0 y 10000' });
    }
  }

  // dateFrom
  if (input.dateFrom) {
    const d = new Date(input.dateFrom);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'dateFrom', message: 'dateFrom inválida' });
    }
  }

  // dateTo
  if (input.dateTo) {
    const d = new Date(input.dateTo);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'dateTo', message: 'dateTo inválida' });
    }
  }

  // mode
  if (input.mode && !VALID_MODES.includes(input.mode)) {
    errors.push({ field: 'mode', message: `mode inválido, opciones: ${VALID_MODES.join(', ')}` });
  }

  // sort
  if (input.sort && !VALID_SORTS.includes(input.sort)) {
    errors.push({ field: 'sort', message: `sort inválido, opciones: ${VALID_SORTS.join(', ')}` });
  }

  // string length validation
  const shortFields: (keyof AdvancedSearchInput)[] = [
    'exact', 'matter', 'source', 'authority', 'impactLevel',
    'sector', 'entity', 'task', 'watchlistId', 'mode', 'sort', 'tipo'
  ];
  for (const field of shortFields) {
    const val = input[field];
    if (typeof val === 'string' && val.length > MAX_STRING_LEN) {
      errors.push({ field, message: `${field} excede ${MAX_STRING_LEN} caracteres` });
    }
  }

  // query length
  if (typeof input.query === 'string' && input.query.length > MAX_QUERY_LEN) {
    errors.push({ field: 'query', message: `query excede ${MAX_QUERY_LEN} caracteres` });
  }

  return errors;
}

/**
 * Parses the advanced search input into a Prisma-safe whereClause and post-query filters.
 * 
 * ONLY uses fields that exist on the Item model for whereClause.
 * authority, sector, entity are returned as postFilters for in-memory filtering.
 */
export function parseAdvancedSearch(input: AdvancedSearchInput, extraKeywords?: string[]): ParsedFilters {
  const where: Record<string, unknown> = {};
  let semanticQuery = input.query || '';
  const expandedKeywords: string[] = extraKeywords ? [...extraKeywords] : [];

  // 1. Text Search (OR across real Item text fields)
  const textConditions: Record<string, unknown>[] = [];

  if (input.exact) {
    // Case-sensitive exact match across text fields
    textConditions.push({ title: { contains: input.exact } });
    textConditions.push({ summary: { contains: input.exact } });
    textConditions.push({ tema: { contains: input.exact } });
    textConditions.push({ category: { contains: input.exact } });
    textConditions.push({ keywordsHit: { contains: input.exact } });
    expandedKeywords.push(input.exact);
  }

  const queryKeywords = [input.query, ...(extraKeywords || [])].filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
  const uniqueQueryKeywords = Array.from(new Set(queryKeywords));

  if (!input.exact && uniqueQueryKeywords.length > 0) {
    for (const kw of uniqueQueryKeywords) {
      textConditions.push({ title: { contains: kw, mode: 'insensitive' } });
      textConditions.push({ summary: { contains: kw, mode: 'insensitive' } });
      textConditions.push({ tema: { contains: kw, mode: 'insensitive' } });
      textConditions.push({ category: { contains: kw, mode: 'insensitive' } });
      textConditions.push({ keywordsHit: { contains: kw, mode: 'insensitive' } });
    }
  }

  // 2. Expand task into filters
  if (input.task) {
    const taskDef = getTaskById(input.task);
    if (taskDef) {
      if (!input.matter && taskDef.matter) {
        where.tema = taskDef.matter;
      }
      if (taskDef.keywords && taskDef.keywords.length > 0) {
        expandedKeywords.push(...taskDef.keywords);
        const keywordConditions = taskDef.keywords.map(kw => ({
          OR: [
            { title: { contains: kw, mode: 'insensitive' } },
            { summary: { contains: kw, mode: 'insensitive' } }
          ]
        }));
        textConditions.push({ OR: keywordConditions });
      }
      if (!semanticQuery) {
        semanticQuery = taskDef.label;
      } else {
        semanticQuery += ' ' + taskDef.label;
      }
    }
  }

  if (textConditions.length > 0) {
    where.OR = textConditions;
  }

  // 3. Exact Prisma filters (ONLY fields that exist on Item model)
  if (input.matter) where.tema = input.matter;
  if (input.source) where.source = input.source;
  if (input.impactLevel) where.impacto = input.impactLevel;
  if (input.tipo) where.tipo = input.tipo;

  // 4. Dates (only if already validated)
  if (input.dateFrom || input.dateTo) {
    const published: Record<string, Date> = {};
    if (input.dateFrom) {
      const d = new Date(input.dateFrom);
      if (!isNaN(d.getTime())) published.gte = d;
    }
    if (input.dateTo) {
      const d = new Date(input.dateTo);
      if (!isNaN(d.getTime())) published.lte = d;
    }
    if (Object.keys(published).length > 0) {
      where.published = published;
    }
  }

  // 5. Post-filters (applied in-memory AFTER Prisma query, since these fields don't exist on Item)
  const postFilters: ParsedFilters['postFilters'] = {};
  if (input.authority) postFilters.authority = input.authority;
  if (input.sector) postFilters.sector = input.sector;
  if (input.entity) postFilters.entity = input.entity;

  return {
    whereClause: where,
    semanticQuery: semanticQuery.trim(),
    expandedKeywords,
    postFilters
  };
}
