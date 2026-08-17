import 'server-only';
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
import { buildStructure, extractMachoteStructure } from './structureBuilder';
import { buildVariableMap } from './variableResolver';
import { validateDocument } from './validator';
import { buildGenerationContext, requiresValidatedSources } from './context';
import { createContentBlock } from './trustLayer';
import { LawyerProfile, DEFAULT_LAWYER_PROFILE } from '../workspace/lawyerProfileTypes';
import { extractStyleFromReferenceDocument, applyStyleToSectionText, evaluateStyleMatch, StyleMatchEvaluation } from './styleEngine';
import { runQualityGateCheck, QualityGateResult } from './qualityGate';
import { runFastMode } from '../ai/orchestrator';

export interface SectionPlan {
  templateSectionId: string;
  title: string;
  objective: string;
  sourceFacts: string[];
  legalIssues: string[];
  historicalReferences: string[];
  expectedDepth: 'SHORT' | 'MEDIUM' | 'DEEP' | 'EXTENSIVE';
  expectedParagraphs: number;
}

export interface DraftingPlan {
  documentType: string;
  caseTitle: string;
  estimatedPages: number;
  estimatedWords: number;
  sections: SectionPlan[];
}

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
  lawyerProfile?: LawyerProfile;
  referenceDocumentText?: string;
  referenceDocumentId?: string;
  matter?: string;
  documentTypeLabel?: string;
  forceAiUnavailable?: boolean;
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

export function sanitizeGeneratedText(rawText: string, context?: { parties?: DocumentParties; caseRefs?: CaseReferences }): string {
  let result = rawText;
  
  result = result.replace(/\[NOMBRE\s+COMPLETO[^\]]*\]/gi, '[DATO PENDIENTE: Nombre de la persona quejosa / parte]');
  result = result.replace(/\[NOMBRE\s+DE\s+LA\s+DEPENDENCIA[^\]]*\]/gi, '[DATO PENDIENTE: Nombre de la autoridad o entidad demandada]');
  result = result.replace(/\[NÚMERO\s+DE\s+EXPEDIENTE\]/gi, '[DATO PENDIENTE: Número de expediente]');
  result = result.replace(/\[SALA\s+CORRESPONDIENTE[^\]]*\]/gi, '[DATO PENDIENTE: Órgano jurisdiccional o Sala]');
  result = result.replace(/\[DESCRIBIR\s+PRETENSIONES[^\]]*\]/gi, '[DATO PENDIENTE: Descripción de pretensiones]');
  result = result.replace(/\[FECHA\s+DE\s+NOTIFICACI[ÓO]N[^\]]*\]/gi, '[DATO PENDIENTE: Fecha de notificación]');

  result = result.replace(/(tesis\s+sin\s+registro|criterio\s+no\s+publicado)/gi, '[NO VERIFICADO: $1]');

  return result;
}

/**
 * Builds a comprehensive multi-section DraftingPlan based on reference document length and case complexity
 */
export function buildDraftingPlan(
  doc: UniversalLegalDocument,
  referenceLength: number = 0
): DraftingPlan {
  const isDeep = referenceLength > 15000;
  const sections: SectionPlan[] = doc.sections.map((sec) => {
    let expectedDepth: SectionPlan['expectedDepth'] = 'MEDIUM';
    let expectedParagraphs = 2;

    if (sec.type === 'header' || sec.type === 'closing' || sec.type === 'signature') {
      expectedDepth = 'SHORT';
      expectedParagraphs = 1;
    } else if (sec.type === 'identity' || sec.type === 'evidence') {
      expectedDepth = 'MEDIUM';
      expectedParagraphs = 3;
    } else if (sec.type === 'background' || sec.type === 'legal_grounds') {
      expectedDepth = isDeep ? 'DEEP' : 'MEDIUM';
      expectedParagraphs = isDeep ? 6 : 3;
    } else if (sec.type === 'argument') {
      expectedDepth = isDeep ? 'EXTENSIVE' : 'DEEP';
      expectedParagraphs = isDeep ? 9 : 5;
    }

    return {
      templateSectionId: sec.id,
      title: sec.title,
      objective: `Desarrollar el apartado ${sec.title} fundado en los hechos del expediente`,
      sourceFacts: [],
      legalIssues: [sec.title],
      historicalReferences: [],
      expectedDepth,
      expectedParagraphs
    };
  });

  const estimatedParagraphs = sections.reduce((acc, s) => acc + s.expectedParagraphs, 0);
  const estimatedWords = estimatedParagraphs * 80;
  const estimatedPages = Math.max(1, Math.ceil(estimatedWords / 250));

  return {
    documentType: doc.documentTypeLabel,
    caseTitle: doc.title,
    estimatedPages,
    estimatedWords,
    sections
  };
}

/**
 * Generates a full multi-paragraph section using real Generative AI when available,
 * or enriched legal template fallback when AI provider key is not active.
 */
export async function generateSection(
  doc: UniversalLegalDocument,
  sectionId: string,
  instruction?: string,
  customGenerator?: (params: { section: DocumentNode; doc: UniversalLegalDocument }) => Promise<string> | string,
  lawyerProfile: LawyerProfile = DEFAULT_LAWYER_PROFILE,
  sectionPlan?: SectionPlan
): Promise<{ text: string; warnings: string[]; sources?: GeneratedSourceReference[]; aiUsed?: boolean; aiProvider?: string; aiModel?: string; aiError?: string }> {
  const sec = doc.sections.find(s => s.id === sectionId);
  if (!sec) return { text: '', warnings: ['Sección no encontrada'] };

  if (customGenerator) {
    const customText = await customGenerator({ section: sec, doc });
    return { text: sanitizeGeneratedText(customText), warnings: [] };
  }

  const genContext = buildGenerationContext({
    instruction: instruction || sec.generationInstruction || `Generar apartado ${sec.title} para ${doc.documentTypeLabel}`,
    sources: doc.sourceDocuments || [],
    sectionTitle: sec.title,
    limit: 8
  });

  // Check if real AI Provider Key is available in environment
  const hasAiKey = Boolean(
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) ||
    (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) ||
    (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) ||
    (process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim())
  );

  const configuredProvider =
    process.env.LLM_PROVIDER?.trim() ||
    (process.env.GEMINI_API_KEY?.trim() ? 'gemini' : undefined) ||
    (process.env.GROQ_API_KEY?.trim() ? 'groq' : undefined) ||
    (process.env.OPENROUTER_API_KEY?.trim() ? 'openrouter' : undefined) ||
    (process.env.NVIDIA_API_KEY?.trim() ? 'nvidia' : undefined) ||
    undefined;
  const configuredModel =
    process.env.LLM_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    undefined;

  let rawSectionText = '';
  let aiUsed = false;
  let aiProvider: string | undefined;
  let aiModel: string | undefined;
  let aiError: string | undefined;

  if (hasAiKey) {
    try {
      const prompt = `Actúa como abogado litigante experto en ${doc.matter || 'amparo'}.
Genera el apartado "${sec.title}" para el escrito "${doc.documentTypeLabel}".
EXPEDIENTE: ${doc.caseRefs.expediente || '[DATO PENDIENTE: Número de Expediente]'}
TRIBUNAL: ${doc.parties.autoridadResponsable || doc.classification.authority || '[DATO PENDIENTE: Órgano Jurisdiccional]'}
QUEJOSO: ${doc.parties.quejoso || doc.parties.actor || '[DATO PENDIENTE: Nombre del Promovente]'}

ESTRUCTURA EXIGIDA PARA CADA AGRAVIO:
1. Planteamiento central
2. Contexto de la resolución
3. Hecho fundante
4. Precepto violado
5. Criterio jurisprudencial
6. Aplicación concreta
7. Refutación
8. Consecuencia jurídica
9. Conclusión

[HECHOS DEL EXPEDIENTE RECUPERADOS]:
${genContext.text.slice(0, 3000)}

Escribe la sección completa con argumentos jurídicos extensos sin resúmenes.`;

      const aiRes = await runFastMode({
        systemPrompt: 'Eres el Motor de Redacción Jurídica Universal de Jurídico Radar.',
        userMessage: prompt,
        mode: 'fast'
      });

      if (aiRes.success && aiRes.content) {
        aiUsed = aiRes.provider !== 'local';
        aiProvider = aiRes.provider;
        aiModel = aiRes.model;
        if (aiUsed) {
          rawSectionText = aiRes.content;
        } else {
          aiProvider = configuredProvider;
          aiModel = configuredModel;
          aiError = `Todos los proveedores de IA configurados fallaron; la cadena devolvió el proveedor local (${aiRes.errorCode || 'error desconocido'}).`;
        }
      } else {
        aiProvider = configuredProvider;
        aiModel = configuredModel;
        aiError = `Proveedores IA fallaron (${aiRes.errorCode || 'sin respuesta'}).`;
      }
    } catch (e) {
      aiProvider = configuredProvider;
      aiModel = configuredModel;
      aiError = (e as Error)?.message || String(e);
      console.warn('[pipeline] LLM invocation failed, using deterministic legal engine fallback:', e);
    }
  } else {
    aiError = 'No hay API key de IA configurada en el entorno.';
  }

  // Fallback to structured legal engine section generation
  if (!rawSectionText) {
    switch (sec.type) {
      case 'header':
        rawSectionText = `${(doc.parties.autoridadResponsable || doc.classification.authority || '[DATO PENDIENTE: Órgano Jurisdiccional]').toUpperCase()}\n` +
                         `PRESENTE.\n` +
                         `EXPEDIENTE: ${doc.caseRefs.expediente || doc.caseRefs.amparo || '[DATO PENDIENTE: Número de Expediente]'}`;
        break;

      case 'identity':
        rawSectionText = `${doc.parties.quejoso || doc.parties.actor || '[DATO PENDIENTE: Nombre del Promovente]'}, por mi propio derecho, con la personalidad debidamente reconocida en los autos del expediente de mérito, comparezco respetuosamente para exponer:`;
        break;

      case 'background':
        rawSectionText = `ANTECEDENTES PROCESALES Y HECHOS DE ORIGEN:\n\n` +
                         `1. De las constancias que integran el expediente de origen se advierten los antecedentes procesales que a continuación se relacionan, en la medida en que obran en autos.\n` +
                         `2. El procedimiento se sustanció observando los plazos y términos de ley en la materia correspondiente.\n` +
                         `3. La resolución recurrida fue emitida por la autoridad señalada como responsable en el expediente respectivo (${doc.parties.autoridadResponsable || '[DATO PENDIENTE: Autoridad Responsable]'}).\n` +
                         (genContext.text ? `4. Constancias del expediente recuperadas:\n${genContext.text.slice(0, 900)}` : '4. [DATO PENDIENTE: Detalle exhaustivo de antecedentes procesales]');
        break;

      case 'legal_grounds':
        rawSectionText = `FUNDAMENTACIÓN Y OPORTUNIDAD PROCESAL DEL RECURSO:\n\n` +
                         `El presente escrito se promueve formalmente con fundamento en los artículos 1, 14, 16, 17 y 107 de la Constitución Política de los Estados Unidos Mexicanos, la Ley de Amparo y la Ley Orgánica del Poder Judicial de la Federación.\n\n` +
                         `El recurso se interpone dentro del plazo legal oportuno de diez días hábiles, contados a partir de que surtió efectos la notificación de la ejecutoria impugnada.`;
        break;

      case 'argument':
        rawSectionText = `${sec.title.toUpperCase()}\n\n` +
                         `1. PLANTEAMIENTO CENTRAL:\n` +
                         `Causa agravio directo e irreparable a esta parte la resolución emitida por la autoridad responsable, toda vez que infringe los principios de exhaustividad, debido proceso y congruencia tutelados en la Ley Suprema.\n\n` +
                         `2. CONTEXTO Y ANTECEDENTE PROCESAL:\n` +
                         `Al dictar el fallo recurrido, la autoridad desatendió consideraciones relevantes, omitiendo valorar en su integridad las constancias que conforman el sumario.\n\n` +
                         `3. HECHO Y PRUEBA FUNDANTE:\n` +
                         (genContext.text ? `Evidencia del expediente:\n${genContext.text.slice(0, 800)}\n\n` : '[DATO PENDIENTE: Hecho específico extraído de las constancias del expediente]\n\n') +
                         `4. NORMA Y VIOLACIÓN CONSTITUCIONAL:\n` +
                         `Se conculcan los artículos 14 y 16 Constitucionales al generarse una indebida motivación e incorrecta distribución de las cargas probatorias en perjuicio del trabajador recurrente.\n\n` +
                         `5. APLICACIÓN Y REFUTACIÓN JURÍDICA:\n` +
                         `Los argumentos sustentados en la sentencia resultan infundados, en virtud de que la autoridad responsable no aplicó el principio de suplencia de la queja ni respetó la eficacia de la cosa juzgada.\n\n` +
                         `6. CONSECUENCIA JURÍDICA Y CONCLUSIÓN:\n` +
                         `Procede revocar la ejecutoria o acto impugnado para el efecto de restituir a esta parte en el pleno goce de las garantías constitucionales violadas.`;
        break;

      case 'evidence':
        rawSectionText = `OFRECIMIENTO DE PRUEBAS E INSTRUMENTAL DE ACTUACIONES:\n\n` +
                         `1. LA DOCUMENTAL PÚBLICA, consistente en la totalidad de las actuaciones que integran el expediente.\n` +
                         `2. LA INSTRUMENTAL DE ACTUACIONES, en todo lo que favorezca a las pretensiones de esta parte.\n` +
                         `3. LA PRESUNCIONAL LEGAL Y HUMANA, en su doble aspecto.`;
        break;

      case 'petition':
        rawSectionText = `PUNTOS PETITORIOS ESTRUCTURADOS:\n\n` +
                         `PRIMERO. Tenerme por presentado en tiempo y forma legal interponiendo el presente escrito y anexos acompañados.\n` +
                         `SEGUNDO. Admitir a trámite el recurso de revisión y sustanciarlo en los términos previstos por la norma aplicable.\n` +
                         `TERCERO. En su oportunidad, declarar FUNDADOS los agravios expuestos y resolver amparando y protegiendo a la parte quejosa.`;
        break;

      case 'closing':
        rawSectionText = `PROTESTO LO NECESARIO EN DERECHO.\n` +
                         `Zapopan, Jalisco, a la fecha de su presentación formal.`;
        break;

      case 'signature':
        rawSectionText = `_____________________________________\n${doc.parties.quejoso || doc.parties.actor || '[DATO PENDIENTE: Nombre y Firma del Promovente]'}`;
        break;

      default:
        rawSectionText = `[DESARROLLO DE SECCIÓN: ${sec.title.toUpperCase()}]\n` +
                         `En atención al escrito promovido y a las constancias recuperadas del expediente...`;
        break;
    }
  }

  const styled = applyStyleToSectionText(sec.type, rawSectionText, lawyerProfile);
  const sanitized = sanitizeGeneratedText(styled, { parties: doc.parties, caseRefs: doc.caseRefs });

  return {
    text: sanitized,
    warnings: [],
    sources: genContext.references,
    aiUsed,
    aiProvider,
    aiModel,
    aiError
  };
}

export async function runGenerationPipeline(
  input: PipelineInput,
  callbacks?: PipelineCallbacks
): Promise<UniversalLegalDocument> {
  if (input.forceAiUnavailable) {
    throw new Error('Generación jurídica bloqueada: proveedor de generación no disponible. Se permite guardar análisis, editar estructura y consultar fuentes.');
  }

  const sources = input.sourceDocuments || input.existingDocument?.sourceDocuments || [];
  const lawyerProfile = input.lawyerProfile || DEFAULT_LAWYER_PROFILE;

  if (sources.length > 0 && requiresValidatedSources(sources)) {
    if (!input.allowUnvalidatedSource && !input.warningMode) {
      throw new Error('La fuente no está validada. Realice o confirme la validación/OCR antes de generar el documento.');
    }
  }

  let sourceStatusLabel = 'FUENTE NO VERIFICADA';
  if (sources.length > 0) {
    const validatedCount = sources.filter(s => s.sourceValidated !== false).length;
    if (validatedCount === sources.length) {
      sourceStatusLabel = 'FUENTE VERIFICADA';
    } else if (validatedCount > 0) {
      sourceStatusLabel = 'FUENTE PARCIAL';
    }
  }

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

  const fullTextFromSources = sources
    .flatMap(s => s.pages?.map(p => p.text) || [s.extractedText || s.content || ''])
    .join('\n\n');
  const combinedText = `${userPrompt}\n\n${fullTextFromSources}`;

  let referenceStyle = null;
  if (input.referenceDocumentText) {
    referenceStyle = extractStyleFromReferenceDocument(input.referenceDocumentText);
  }
  
  try {
    // Stage 1: Classify
    updateStage('classify', 'running');
    callbacks?.onStageStart?.('classify', doc);
    doc.classification = input.existingClassification || classifyIntent(userPrompt || fullTextFromSources || 'escrito libre');
    if (input.matter) doc.classification = { ...doc.classification, matter: input.matter };
    if (input.documentTypeLabel) doc.classification = { ...doc.classification, documentTypeLabel: input.documentTypeLabel };
    doc.documentType = doc.classification.documentType;
    doc.documentTypeLabel = doc.classification.documentTypeLabel;
    doc.matter = doc.classification.matter;
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
      note: `Extraída evidencia relevante de ${sources.length} documento(s) fuente (${analysisContext.chunks.length} fragmentos). Status: ${sourceStatusLabel}`
    });
    updateStage('analyze', 'complete');
    callbacks?.onStageComplete?.('analyze', doc);
    
    // Stage 4: Structure (Use Machote deep structure if reference text provided)
    updateStage('structure', 'running');
    callbacks?.onStageStart?.('structure', doc);
    if (!doc.sections || doc.sections.length === 0) {
      if (input.referenceDocumentText && input.referenceDocumentText.length > 500) {
        doc.sections = extractMachoteStructure(input.referenceDocumentText);
      } else {
        doc.sections = buildStructure(doc.classification);
      }
    }
    updateStage('structure', 'complete');
    callbacks?.onStageComplete?.('structure', doc);
    
    // Stage 5: Identify Issues & Drafting Plan
    updateStage('identify_issues', 'running');
    callbacks?.onStageStart?.('identify_issues', doc);
    const draftingPlan = buildDraftingPlan(doc, input.referenceDocumentText?.length || 0);
    (doc as any).draftingPlan = draftingPlan;
    updateStage('identify_issues', 'complete');
    callbacks?.onStageComplete?.('identify_issues', doc);
    
    // Stage 6: Generate Sections
    updateStage('generate_sections', 'running');
    callbacks?.onStageStart?.('generate_sections', doc);

    let pipelineAiUsed = false;
    let pipelineAiProvider: string | undefined;
    let pipelineAiModel: string | undefined;
    let pipelineAiError: string | undefined;

    for (let i = 0; i < doc.sections.length; i++) {
      const section = doc.sections[i];

      if (input.targetSection && section.id !== input.targetSection) {
        continue;
      }

      const sectionIsManuallyEdited = section.isManuallyEdited || section.content?.some(b => b.isManuallyEdited);
      if (sectionIsManuallyEdited && input.existingDocument) {
        continue;
      }

      const secPlan = draftingPlan.sections.find(p => p.templateSectionId === section.id);
      const generated = await generateSection(
        doc,
        section.id,
        input.sectionInstruction || input.userInstruction,
        input.generateSection,
        lawyerProfile,
        secPlan
      );

      if (generated.aiUsed) {
        pipelineAiUsed = true;
        pipelineAiProvider = generated.aiProvider || pipelineAiProvider;
        pipelineAiModel = generated.aiModel || pipelineAiModel;
      } else if (generated.aiError) {
        pipelineAiError = generated.aiError;
        pipelineAiProvider = pipelineAiProvider || generated.aiProvider;
        pipelineAiModel = pipelineAiModel || generated.aiModel;
      }

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

    doc.generationMetadata.aiUsed = pipelineAiUsed;
    doc.generationMetadata.aiProvider = pipelineAiProvider || null;
    doc.generationMetadata.aiModel = pipelineAiModel || null;
    doc.generationMetadata.aiError = pipelineAiError || null;
    
    updateStage('generate_sections', 'complete');
    callbacks?.onStageComplete?.('generate_sections', doc);
    
    // Stage 7: Review Coherence & Style Match
    updateStage('review_coherence', 'running');
    callbacks?.onStageStart?.('review_coherence', doc);
    if (input.referenceDocumentText) {
      const allGenText = doc.sections.flatMap(s => s.content.map(b => b.text)).join('\n\n');
      const styleMatch = evaluateStyleMatch(input.referenceDocumentText, allGenText);
      (doc as any).styleMatch = styleMatch;
    }
    updateStage('review_coherence', 'complete');
    callbacks?.onStageComplete?.('review_coherence', doc);
    
    // Stage 8: Validate & Quality Gate (with Proportionality Check)
    updateStage('validate', 'running');
    callbacks?.onStageStart?.('validate', doc);
    doc.validation = validateDocument(doc);
    
    const qgResult = runQualityGateCheck(doc, { referenceLength: input.referenceDocumentText?.length || 0 });
    if (!qgResult.passed) {
      doc.validation.isValid = false;
      doc.validation.errors.push(...qgResult.criticalErrors);
    }
    doc.validation.warnings.push(...qgResult.warnings);

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
