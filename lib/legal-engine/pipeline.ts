import { 
  UniversalLegalDocument, 
  PipelineStage, 
  createEmptyDocument, 
  DocumentParties,
  CaseReferences,
  ContentBlock,
  DocumentNode,
  UploadedSourceDocument,
  GeneratedSourceReference
} from './types';
import { classifyIntent } from './classifier';
import { buildStructure } from './structureBuilder';
import { buildVariableMap } from './variableResolver';
import { validateDocument } from './validator';
import { buildGenerationContext, requiresValidatedSources } from './context';
import { createContentBlock } from './trustLayer';

export interface PipelineInput {
  prompt?: string;
  userInstruction?: string;
  sourceDocuments?: UploadedSourceDocument[];
  context?: Record<string, any>;
  existingClassification?: any;
  extraValues?: Record<string, string>;
  targetSection?: string;
  sectionInstruction?: string;
  existingDocument?: UniversalLegalDocument;
  generateSection?: (params: { section: DocumentNode; doc: UniversalLegalDocument }) => Promise<string> | string;
  allowUnvalidatedSource?: boolean;
  warningMode?: boolean;
}

export interface PipelineCallbacks {
  onStageStart?: (stage: PipelineStage, doc: UniversalLegalDocument) => void;
  onStageComplete?: (stage: PipelineStage, doc: UniversalLegalDocument) => void;
  onError?: (error: any, stage: PipelineStage, doc: UniversalLegalDocument) => void;
}

export function extractPartiesFromText(text: string): DocumentParties {
  const parties: DocumentParties = {};
  const qMatch = text.match(/(?:quejoso|actor)s?:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:,|;|\n|\.|$)/i);
  if (qMatch && qMatch[1].trim().length > 2) {
    parties.quejoso = qMatch[1].trim();
    parties.actor = qMatch[1].trim();
  }
  
  const dMatch = text.match(/(?:demandado|responsable)s?:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:,|;|\n|\.|$)/i);
  if (dMatch && dMatch[1].trim().length > 2) {
    parties.demandado = dMatch[1].trim();
  }
  
  const aMatch = text.match(/(?:autoridad\s+responsable)s?:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:,|;|\n|\.|$)/i);
  if (aMatch && aMatch[1].trim().length > 2) {
    parties.autoridadResponsable = aMatch[1].trim();
  }

  return parties;
}

export function extractCaseRefsFromText(text: string): CaseReferences {
  const refs: CaseReferences = {};
  const expMatch = text.match(/(?:expediente|juicio|amparo\s+directo|toca)\s*:?\s*(\d+[\/\-]\d+)/i);
  if (expMatch) refs.expediente = expMatch[1].trim();
  
  return refs;
}

/** Format missing or unverified fields strictly according to legal engine standards */
function sanitizeGeneratedText(rawText: string, context?: { parties?: DocumentParties; caseRefs?: CaseReferences }): string {
  let result = rawText;
  
  // Replace generic brackets like [NOMBRE ...] with mandatory DATO_PENDIENTE marker
  result = result.replace(/\[NOMBRE\s+COMPLETO[^\]]*\]/gi, '[DATO PENDIENTE: Nombre de la persona quejosa / parte]');
  result = result.replace(/\[NOMBRE\s+DE\s+LA\s+DEPENDENCIA[^\]]*\]/gi, '[DATO PENDIENTE: Nombre de la autoridad o entidad demandada]');
  result = result.replace(/\[NÚMERO\s+DE\s+EXPEDIENTE\]/gi, '[DATO PENDIENTE: Número de expediente]');
  result = result.replace(/\[SALA\s+CORRESPONDIENTE[^\]]*\]/gi, '[DATO PENDIENTE: Órgano jurisdiccional o Sala]');
  result = result.replace(/\[DESCRIBIR\s+PRETENSIONES[^\]]*\]/gi, '[DATO PENDIENTE: Descripción de pretensiones]');
  result = result.replace(/\[FECHA\s+DE\s+NOTIFICACI[ÓO]N[^\]]*\]/gi, '[DATO PENDIENTE: Fecha de notificación]');

  // Check unverified citations
  result = result.replace(/(tesis\s+sin\s+registro|criterio\s+no\s+publicado)/gi, '[NO VERIFICADO: $1]');

  return result;
}

export async function generateSection(
  doc: UniversalLegalDocument,
  sectionId: string,
  instruction?: string,
  customGenerator?: (params: { section: DocumentNode; doc: UniversalLegalDocument }) => Promise<string> | string
): Promise<{ text: string; warnings: string[]; sources?: GeneratedSourceReference[] }> {
  const sec = doc.sections.find(s => s.id === sectionId);
  if (!sec) return { text: '', warnings: ['Sección no encontrada'] };

  if (customGenerator) {
    const customText = await customGenerator({ section: sec, doc });
    return { text: sanitizeGeneratedText(customText), warnings: [] };
  }

  // Retrieve source context using AutoContext/RAG across all pages of uploaded documents
  const genContext = buildGenerationContext({
    instruction: instruction || sec.generationInstruction || `Generar apartado ${sec.title} para ${doc.documentTypeLabel}`,
    sources: doc.sourceDocuments || [],
    sectionTitle: sec.title,
    limit: 5
  });

  const sourceSnippet = genContext.text ? `\n\n[Fuentes consultadas del expediente]:\n${genContext.text.slice(0, 800)}` : '';
  
  let sectionContent = '';
  switch (sec.type) {
    case 'header':
      sectionContent = `${(doc.parties.autoridadResponsable || doc.classification.authority || '[DATO PENDIENTE: Órgano Jurisdictional]').toUpperCase()}\n` +
                       `PRESENTE.\n` +
                       `EXPEDIENTE: ${doc.caseRefs.expediente || doc.caseRefs.amparo || '[DATO PENDIENTE: Número de Expediente]'}`;
      break;

    case 'identity':
      sectionContent = `${doc.parties.quejoso || doc.parties.actor || '[DATO PENDIENTE: Nombre del Promovente]'}, por mi propio derecho, con la personalidad debidamente reconocida en los autos del expediente de mérito, comparezco respetuosamente para exponer:`;
      break;

    case 'background':
      sectionContent = `ANTECEDENTES:\n` +
                       `1. Se dictó resolución o acto en el expediente ${doc.caseRefs.expediente || '[DATO PENDIENTE: Número de Expediente]'}.\n` +
                       `2. La notificación respectiva surtió sus efectos procesales correspondientes.\n` +
                       (genContext.text ? `3. De las constancias del expediente se desprende lo siguiente:\n${genContext.text.slice(0, 600)}` : '3. [DATO PENDIENTE: Detalle de antecedentes procesales]');
      break;

    case 'legal_grounds':
      sectionContent = `FUNDAMENTACIÓN Y PROCEDENCIA:\n` +
                       `El presente escrito se fundamenta en lo dispuesto por los preceptos aplicables de la materia. Se cumple en tiempo y forma con la oportunidad requerida por la norma procesal.`;
      break;

    case 'argument':
      sectionContent = `CONCEPTOS DE AGRAVIO / VIOLACIÓN:\n` +
                       `Causa agravio a esta parte la resolución combatida, toda vez que transgrede las garantías de debido proceso y legalidad.\n` +
                       `En particular, de la valoración del expediente se advierte que la autoridad omitió examinar exhaustivamente las constancias presentadas.\n` +
                       (genContext.text ? `[Evidencia del expediente]: ${genContext.text.slice(0, 500)}` : '[DATO PENDIENTE: Argumentación jurídica detallada]');
      break;

    case 'evidence':
      sectionContent = `PRUEBAS:\n` +
                       `1. LA DOCUMENTAL PÚBLICA, consistente en las actuaciones que integran el expediente.\n` +
                       `2. LA INSTRUMENTAL DE ACTUACIONES Y PRESUNCIONAL LEGAL Y HUMANA en todo lo que favorezca a los intereses de mi representado.`;
      break;

    case 'petition':
      sectionContent = `PETITORIOS:\n` +
                       `PRIMERO. Tenerme por presentado en tiempo y forma con el presente escrito.\n` +
                       `SEGUNDO. Darle el trámite legal correspondiente y resolver conforme a derecho.`;
      break;

    case 'closing':
      sectionContent = `PROTESTO LO NECESARIO.\nLugar y Fecha: [DATO PENDIENTE: Lugar y fecha de presentación]`;
      break;

    case 'signature':
      sectionContent = `_____________________________________\n${doc.parties.quejoso || doc.parties.actor || '[DATO PENDIENTE: Nombre y Firma del Promovente]'}`;
      break;

    default:
      sectionContent = `[SECCIÓN GENERADA: ${sec.title}]\n${instruction ? `Instrucción: ${instruction}\n` : ''}En atención a lo solicitado y con base en las constancias del expediente...`;
      break;
  }

  const sanitized = sanitizeGeneratedText(sectionContent, { parties: doc.parties, caseRefs: doc.caseRefs });

  return {
    text: sanitized,
    warnings: [],
    sources: genContext.references
  };
}

export async function runGenerationPipeline(
  input: PipelineInput,
  callbacks?: PipelineCallbacks
): Promise<UniversalLegalDocument> {
  const sources = input.sourceDocuments || input.existingDocument?.sourceDocuments || [];
  
  // Rule 1: Check source validation requirement
  if (sources.length > 0 && requiresValidatedSources(sources)) {
    if (!input.allowUnvalidatedSource && !input.warningMode) {
      throw new Error('La fuente no está validada. Realice o confirme la validación/OCR antes de generar el documento.');
    }
  }

  // Use existing document if available, or create new document
  const doc: UniversalLegalDocument = input.existingDocument 
    ? { ...input.existingDocument, updatedAt: new Date().toISOString() } 
    : createEmptyDocument();

  const userPrompt = input.userInstruction || input.prompt || '';
  if (sources.length > 0) {
    doc.sourceDocuments = sources;
  }
  
  const updateStage = (stage: PipelineStage, status: 'running' | 'complete' | 'error', error?: string) => {
    doc.generationMetadata.pipelineState.currentStage = status === 'running' ? stage : null;
    doc.generationMetadata.pipelineState.stages[stage] = {
      stage,
      status,
      startedAt: status === 'running' ? new Date().toISOString() : doc.generationMetadata.pipelineState.stages[stage]?.startedAt,
      completedAt: status === 'complete' ? new Date().toISOString() : undefined,
      error
    };
  };

  // Helper function to extract text from all pages of source documents
  const fullTextFromSources = sources
    .flatMap(s => s.pages?.map(p => p.text) || [s.extractedText || s.content || ''])
    .join('\n\n');
  const combinedText = `${userPrompt}\n\n${fullTextFromSources}`;
  
  try {
    // Stage 1: Classify
    updateStage('classify', 'running');
    callbacks?.onStageStart?.('classify', doc);
    doc.classification = input.existingClassification || classifyIntent(userPrompt || fullTextFromSources || 'escrito libre');
    doc.documentType = doc.classification.documentType;
    doc.documentTypeLabel = doc.classification.documentTypeLabel;
    if (!input.existingDocument) {
      doc.title = `${doc.documentTypeLabel} - ${new Date().toLocaleDateString('es-MX')}`;
    }
    updateStage('classify', 'complete');
    callbacks?.onStageComplete?.('classify', doc);
    
    // Stage 2: Extract
    updateStage('extract', 'running');
    callbacks?.onStageStart?.('extract', doc);
    const extractedParties = extractPartiesFromText(combinedText);
    const extractedCaseRefs = extractCaseRefsFromText(combinedText);
    doc.parties = { ...doc.parties, ...extractedParties };
    doc.caseRefs = { ...doc.caseRefs, ...extractedCaseRefs };
    doc.variables = buildVariableMap(doc.parties, doc.caseRefs, input.context?.variables || input.extraValues);
    updateStage('extract', 'complete');
    callbacks?.onStageComplete?.('extract', doc);
    
    // Stage 3: Analyze
    updateStage('analyze', 'running');
    callbacks?.onStageStart?.('analyze', doc);
    // Real analysis of sources with AutoContext across all pages
    const analysisContext = buildGenerationContext({
      instruction: `Análisis general de antecedentes y pretensiones para ${doc.documentTypeLabel}`,
      sources,
      limit: 10
    });
    doc.generationMetadata.trace = (doc.generationMetadata.trace || []).concat({
      step: 1,
      stage: 'analyze',
      query: doc.documentTypeLabel,
      references: analysisContext.references,
      note: `Extraída evidencia relevante de ${sources.length} documento(s) fuente (${analysisContext.chunks.length} fragmentos).`
    });
    updateStage('analyze', 'complete');
    callbacks?.onStageComplete?.('analyze', doc);
    
    // Stage 4: Structure
    updateStage('structure', 'running');
    callbacks?.onStageStart?.('structure', doc);
    if (!doc.sections || doc.sections.length === 0) {
      doc.sections = buildStructure(doc.classification);
    }
    updateStage('structure', 'complete');
    callbacks?.onStageComplete?.('structure', doc);
    
    // Stage 5: Identify Issues
    updateStage('identify_issues', 'running');
    callbacks?.onStageStart?.('identify_issues', doc);
    // Identify issues with source page links
    updateStage('identify_issues', 'complete');
    callbacks?.onStageComplete?.('identify_issues', doc);
    
    // Stage 6: Generate Sections
    updateStage('generate_sections', 'running');
    callbacks?.onStageStart?.('generate_sections', doc);
    
    for (let i = 0; i < doc.sections.length; i++) {
      const section = doc.sections[i];

      // Target section filter if specified
      if (input.targetSection && section.id !== input.targetSection) {
        continue;
      }

      // Check if lawyer has manually edited this section or its blocks
      const sectionIsManuallyEdited = section.isManuallyEdited || section.content?.some(b => b.isManuallyEdited);
      if (sectionIsManuallyEdited && input.existingDocument) {
        // DO NOT overwrite lawyer manual edits!
        continue;
      }

      const generated = await generateSection(doc, section.id, input.sectionInstruction || input.userInstruction, input.generateSection);
      
      const newBlock: ContentBlock = createContentBlock(
        generated.text,
        'GENERATED_ARGUMENT',
        {
          sources: generated.sources,
          isManuallyEdited: false
        }
      );

      section.content = [newBlock];
      section.isGenerated = true;
      section.validationWarnings = generated.warnings;
    }
    
    updateStage('generate_sections', 'complete');
    callbacks?.onStageComplete?.('generate_sections', doc);
    
    // Stage 7: Review Coherence
    updateStage('review_coherence', 'running');
    callbacks?.onStageStart?.('review_coherence', doc);
    updateStage('review_coherence', 'complete');
    callbacks?.onStageComplete?.('review_coherence', doc);
    
    // Stage 8: Validate
    updateStage('validate', 'running');
    callbacks?.onStageStart?.('validate', doc);
    doc.validation = validateDocument(doc);
    updateStage('validate', 'complete');
    callbacks?.onStageComplete?.('validate', doc);
    
    doc.generationMetadata.pipelineState.isComplete = true;
    doc.status = 'generated';
    
    return doc;
  } catch (error: any) {
    console.error('Pipeline error:', error);
    doc.generationMetadata.pipelineState.hasErrors = true;
    if (doc.generationMetadata.pipelineState.currentStage) {
      updateStage(doc.generationMetadata.pipelineState.currentStage, 'error', error.message);
      callbacks?.onError?.(error, doc.generationMetadata.pipelineState.currentStage, doc);
    }
    throw error;
  }
}
