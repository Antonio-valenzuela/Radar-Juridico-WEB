import type { DocumentPage, GeneratedSourceReference, UploadedSourceDocument } from './types';

export type DocumentSourceInput = Omit<UploadedSourceDocument, 'content' | 'extractedText'> & {
  content?: string;
  extractedText?: string;
  pages?: DocumentPage[];
  sourceValidated: boolean;
};

export interface ContextChunk {
  id: string;
  text: string;
  page: number;
  documentId: string;
  sourceName: string;
}

export interface GenerationContext {
  text: string;
  references: GeneratedSourceReference[];
  chunks: ContextChunk[];
}

export function createSourceDocument(source: DocumentSourceInput): UploadedSourceDocument {
  const pages = source.pages?.length ? source.pages : [{ page: 1, text: source.extractedText || source.content || '', chars: (source.extractedText || source.content || '').length }];
  const extractedText = pages.map((page) => page.text).join('\n\n');
  return { ...source, pages, extractedText, content: extractedText };
}

export function requiresValidatedSources(sources: UploadedSourceDocument[]): boolean {
  return sources.some((source) => source.sourceValidated === false);
}

function headingForPage(page: DocumentPage): string {
  const line = page.text.split(/\r?\n/).find((candidate) => candidate.trim().length > 3 && candidate.trim().length < 160);
  return page.heading || line?.trim() || 'Sin encabezado detectado';
}

export function buildAutoContext(source: UploadedSourceDocument, maxChars = 1200): ContextChunk[] {
  const pages = source.pages?.length ? source.pages : [{ page: 1, text: source.extractedText || source.content || '', chars: (source.extractedText || source.content || '').length }];
  const sourceName = source.filename || source.name || 'Documento sin nombre';
  const result: ContextChunk[] = [];
  for (const page of pages) {
    const prefix = `Documento: ${sourceName}\nPágina: ${page.page}\nContexto: ${headingForPage(page)}\n\n`;
    const paragraphs = page.text.split(/\n\s*\n/).filter(Boolean);
    let current = '';
    for (const paragraph of paragraphs.length ? paragraphs : [page.text]) {
      if (current && current.length + paragraph.length > maxChars) {
        result.push({ id: `${source.id}:${page.page}:${result.length}`, text: prefix + current.trim(), page: page.page, documentId: source.id, sourceName });
        current = paragraph;
      } else current += `${current ? '\n\n' : ''}${paragraph}`;
    }
    if (current.trim()) result.push({ id: `${source.id}:${page.page}:${result.length}`, text: prefix + current.trim(), page: page.page, documentId: source.id, sourceName });
  }
  return result;
}

function score(query: string, chunk: ContextChunk): number {
  const terms = query.toLocaleLowerCase('es-MX').match(/[\p{L}\p{N}]{4,}/gu) || [];
  const text = chunk.text.toLocaleLowerCase('es-MX');
  return terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0) + Math.min(chunk.text.length / 10_000, 0.2);
}

export function buildGenerationContext(input: { instruction: string; sources: UploadedSourceDocument[]; sectionTitle?: string; limit?: number }): GenerationContext {
  const chunks = input.sources.flatMap((source) => buildAutoContext(source));
  const query = `${input.instruction} ${input.sectionTitle || ''}`;
  const selected = chunks.map((chunk) => ({ chunk, score: score(query, chunk) })).sort((a, b) => b.score - a.score).slice(0, input.limit || 6);
  return {
    text: selected.map(({ chunk }) => chunk.text).join('\n\n---\n\n'),
    chunks: selected.map(({ chunk }) => chunk),
    references: selected.map(({ chunk, score: relevance }) => ({ documentId: chunk.documentId, page: chunk.page, textSnippet: chunk.text.slice(0, 500), score: relevance, sourceType: 'SOURCE_FACT' })),
  };
}

import { createEmptyDocument } from './types';
import type { StructuredDocument, DocumentNode, ContentBlock, UniversalLegalDocument } from './types';

export function structuredTemplateToUniversalDocument(
  tpl: { id: string; title: string; category?: string; practiceArea?: string; jurisdiction?: string; documentType?: string; structureJson?: any; originalText?: string | null; content?: string | null },
  fileUrl?: string
): UniversalLegalDocument {
  const structure = tpl.structureJson as StructuredDocument | undefined;

  // Si no hay structureJson o no tiene páginas estructuradas, caemos al fallback heredado
  if (!structure || !Array.isArray(structure.pages) || structure.pages.length === 0) {
    const refText = tpl.originalText || tpl.content || '';
    const rawParagraphs = refText.split(/\n\s*\n/).filter((t: string) => t.trim().length > 0);
    const blocks: ContentBlock[] = (rawParagraphs.length > 0 ? rawParagraphs : [refText || 'Sin texto']).map((parText: string, bIdx: number) => {
      return {
        id: `blk-tpl-${bIdx + 1}`,
        layer: 'USER_POSITION' as const,
        trustLevel: 'VERIFIED' as const,
        text: parText,
        isManuallyEdited: false,
        style: {
          fontFamily: 'inherit',
          fontSize: '13px',
          textAlign: 'justify',
          lineHeight: '1.6',
        },
      };
    });

    return createEmptyDocument({
      id: `doc-${tpl.id}-${Date.now()}`,
      templateId: tpl.id,
      title: tpl.title,
      documentType: tpl.documentType || 'machote',
      documentTypeLabel: tpl.category || 'Machote',
      matter: tpl.practiceArea || 'Amparo',
      jurisdiction: tpl.jurisdiction || 'Cd. de México',
      originalFormat: fileUrl ? 'pdf' : 'custom',
      originalFileUrl: fileUrl,
      sections: [
        {
          id: `sec-tpl-1`,
          type: 'argument',
          title: tpl.title,
          order: 1,
          isRepeatable: false,
          isEditable: true,
          isGenerated: false,
          isManuallyEdited: false,
          variables: [],
          validationErrors: [],
          validationWarnings: [],
          content: blocks,
        },
      ],
      status: 'draft',
    });
  }

  // Mapeamos cada página estructurada de NVIDIA a una sección (DocumentNode) del documento
  const sections: DocumentNode[] = structure.pages.map((p, pIdx) => {
    let blocks: ContentBlock[] = [];

    if (Array.isArray(p.blocks) && p.blocks.length > 0) {
      blocks = p.blocks
        .filter((nb) => nb.text && nb.text.trim().length > 0 && nb.type !== 'Metadata')
        .map((nb, bIdx) => ({
          id: `blk-tpl-${p.pageNumber}-${bIdx + 1}`,
          layer: 'USER_POSITION' as const,
          trustLevel: 'VERIFIED' as const,
          text: nb.text || '',
          isManuallyEdited: false,
          style: nb.style || {
            fontFamily: 'inherit',
            fontSize: '13px',
            textAlign: 'justify' as const,
            lineHeight: '1.6',
          },
          type: nb.type,
          bbox: nb.bbox,
          tableData: nb.tableData,
          pageNumber: p.pageNumber,
          order: nb.order,
        }));
    }

    // Fallback por si la página no tiene bloques
    if (blocks.length === 0) {
      blocks = [{
        id: `blk-tpl-${p.pageNumber}-1`,
        layer: 'USER_POSITION' as const,
        trustLevel: 'VERIFIED' as const,
        text: p.text || '',
        isManuallyEdited: false,
        style: { fontFamily: 'inherit', fontSize: '13px', textAlign: 'justify' as const, lineHeight: '1.6' },
        pageNumber: p.pageNumber,
      }];
    }

    return {
      id: `sec-tpl-page-${p.pageNumber}`,
      type: pIdx === 0 ? 'header' : pIdx === structure.pages.length - 1 ? 'closing' : 'argument',
      title: `Página ${p.pageNumber}`,
      order: pIdx + 1,
      isRepeatable: true,
      isEditable: true,
      isGenerated: false,
      isManuallyEdited: false,
      variables: [],
      validationErrors: [],
      validationWarnings: [],
      content: blocks,
    };
  });

  return createEmptyDocument({
    id: `doc-${tpl.id}-${Date.now()}`,
    templateId: tpl.id,
    title: tpl.title,
    documentType: tpl.documentType || 'machote',
    documentTypeLabel: tpl.category || 'Machote',
    matter: tpl.practiceArea || 'Amparo',
    jurisdiction: tpl.jurisdiction || 'Cd. de México',
    originalFormat: fileUrl ? 'pdf' : 'custom',
    originalFileUrl: fileUrl,
    sections,
    status: 'draft',
  });
}
