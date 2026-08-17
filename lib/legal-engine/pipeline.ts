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
import { extractStyleFromReferenceDocument, applyStyleToSectionText, evaluateStyleMatch } from './styleEngine';
import { runQualityGateCheck } from './qualityGate';
import { runFastMode } from '../ai/orchestrator';
import { reconstructCaseAnalysis, CaseAnalysis, CaseTheory, ArgumentAxis } from './caseAnalysis';

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
  caseTheory?: CaseTheory;
  argumentAxes?: ArgumentAxis[];
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

export function sanitizeGeneratedText(
  rawText: string,
  context?: { parties?: DocumentParties; caseRefs?: CaseReferences }
): string {
  let result = rawText;
  
  result = result.replace(/\[NOMBRE\s+COMPLETO[^\]]*\]/gi, '[DATO PENDIENTE DE EXPEDIENTE: Nombre del quejoso / promovente]');
  result = result.replace(/\[NOMBRE\s+DE\s+LA\s+DEPENDENCIA[^\]]*\]/gi, '[DATO PENDIENTE DE EXPEDIENTE: Autoridad responsable]');
  result = result.replace(/\[NÚMERO\s+DE\s+EXPEDIENTE\]/gi, '[DATO PENDIENTE DE EXPEDIENTE: Número de expediente]');
  result = result.replace(/\[SALA\s+CORRESPONDIENTE[^\]]*\]/gi, '[DATO PENDIENTE DE EXPEDIENTE: Órgano jurisdiccional competente]');
  result = result.replace(/\[DESCRIBIR\s+PRETENSIONES[^\]]*\]/gi, '[DATO PENDIENTE DE EXPEDIENTE: Descripción de pretensiones]');
  result = result.replace(/\[FECHA\s+DE\s+NOTIFICACI[ÓO]N[^\]]*\]/gi, '[DATO PENDIENTE DE EXPEDIENTE: Fecha de notificación]');

  result = result.replace(/(tesis\s+sin\s+registro|criterio\s+no\s+publicado)/gi, '[NO VERIFICADO: $1]');

  return result;
}

/**
 * Construye el plan de redacción jurídico fundado en el análisis del caso y en la teoría jurídica
 */
export function buildDraftingPlan(
  doc: UniversalLegalDocument,
  referenceLength: number = 0,
  caseAnalysis?: CaseAnalysis
): DraftingPlan {
  const isDeep = referenceLength > 12000;
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
      expectedParagraphs = isDeep ? 6 : 4;
    } else if (sec.type === 'argument') {
      expectedDepth = isDeep ? 'EXTENSIVE' : 'DEEP';
      expectedParagraphs = isDeep ? 8 : 5;
    }

    return {
      templateSectionId: sec.id,
      title: sec.title,
      objective: `Desarrollar jurídicamente ${sec.title} con fundamento en las constancias del expediente`,
      sourceFacts: caseAnalysis?.proceduralTimeline.map((e) => `${e.date}: ${e.event}`) || [],
      legalIssues: [sec.title],
      historicalReferences: [],
      expectedDepth,
      expectedParagraphs,
    };
  });

  const estimatedParagraphs = sections.reduce((acc, s) => acc + s.expectedParagraphs, 0);
  const estimatedWords = estimatedParagraphs * 85;
  const estimatedPages = Math.max(1, Math.ceil(estimatedWords / 250));

  return {
    documentType: doc.documentTypeLabel,
    caseTitle: doc.title,
    estimatedPages,
    estimatedWords,
    sections,
    caseTheory: caseAnalysis?.caseTheory,
    argumentAxes: caseAnalysis?.argumentAxes,
  };
}

/**
 * Genera cada sección jurídica con estricto apego al expediente y a la teoría del caso
 */
export async function generateSection(
  doc: UniversalLegalDocument,
  sectionId: string,
  instruction?: string,
  customGenerator?: (params: { section: DocumentNode; doc: UniversalLegalDocument }) => Promise<string> | string,
  lawyerProfile: LawyerProfile = DEFAULT_LAWYER_PROFILE,
  sectionPlan?: SectionPlan,
  caseAnalysis?: CaseAnalysis
): Promise<{ text: string; warnings: string[]; sources?: GeneratedSourceReference[]; aiUsed?: boolean; aiProvider?: string; aiModel?: string; aiError?: string }> {
  const sec = doc.sections.find((s) => s.id === sectionId);
  if (!sec) return { text: '', warnings: ['Sección no encontrada'] };

  if (customGenerator) {
    const customText = await customGenerator({ section: sec, doc });
    return { text: sanitizeGeneratedText(customText), warnings: [] };
  }

  const genContext = buildGenerationContext({
    instruction: instruction || sec.generationInstruction || `Generar apartado ${sec.title} para ${doc.documentTypeLabel}`,
    sources: doc.sourceDocuments || [],
    sectionTitle: sec.title,
    limit: 10,
  });

  const hasAiKey = Boolean(
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) ||
    (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) ||
    (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim()) ||
    (process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim())
  );

  let rawSectionText = '';
  let aiUsed = false;
  let aiProvider: string | undefined;
  let aiModel: string | undefined;
  let aiError: string | undefined;

  const quejosoName = doc.parties.quejoso || doc.parties.actor || caseAnalysis?.parties?.quejoso || '[DATO PENDIENTE DE EXPEDIENTE: Nombre del quejoso]';
  const autoridadName = doc.parties.autoridadResponsable || caseAnalysis?.parties?.autoridadResponsable || '[DATO PENDIENTE DE EXPEDIENTE: Autoridad responsable]';
  const expedienteNum = doc.caseRefs.expediente || caseAnalysis?.caseNumbers?.principal || '[DATO PENDIENTE DE EXPEDIENTE: Número de expediente]';

  if (hasAiKey) {
    try {
      const prompt = `Actúa como abogado postulante especializado en litigio constitucional y amparo mexicano.
Redacta el apartado "${sec.title}" para el documento judicial: "${doc.documentTypeLabel}".

EXPEDIENTE: ${expedienteNum}
AUTORIDAD: ${autoridadName}
PARTE QUEJOSA/PROMOVENTE: ${quejosoName}
MATERIA: ${doc.matter || 'Amparo'}

CONTEXTO PROCESAL Y TEORÍA DEL CASO:
${caseAnalysis?.caseTheory?.factualTheory || 'Controversia derivada de los autos del expediente.'}
${caseAnalysis?.caseTheory?.legalTheory || ''}
${caseAnalysis?.caseTheory?.constitutionalTheory || ''}

REGLAS OBLIGATORIAS:
1. NO inventes hechos, fechas, autoridades ni jurisprudencia que no consten en las fuentes.
2. Si un dato no está disponible, utiliza estrictamente: [DATO PENDIENTE DE EXPEDIENTE].
3. Aplica contraste riguroso con la resolución impugnada ("El Tribunal sostuvo... Sin embargo... El problema constitucional radica en... Por tanto...").
4. Mantén redacción forense mexicana formal, técnica y persuasiva sin relleno.

[FRAGMENTOS DEL EXPEDIENTE RECUPERADOS]:
${genContext.text.slice(0, 3500)}

Escribe la sección completa con desarrollo argumentativo exhaustivo.`;

      const aiRes = await runFastMode({
        systemPrompt: 'Eres el Motor Forense de Análisis y Redacción Jurídica de Jurídico Radar.',
        userMessage: prompt,
        mode: 'fast',
      });

      if (aiRes.success && aiRes.content) {
        aiUsed = aiRes.provider !== 'local';
        aiProvider = aiRes.provider;
        aiModel = aiRes.model;
        rawSectionText = aiRes.content;
      }
    } catch (e: any) {
      aiError = e?.message || String(e);
      console.warn('[pipeline] Falló llamada a proveedor de IA, utilizando generador forense determinístico:', e);
    }
  }

  // Generador forense determinístico cuando la IA externa no esté disponible
  if (!rawSectionText) {
    const secTitleUpper = String(sec.title || 'Apartado').toUpperCase();
    switch (sec.type) {
      case 'header':
        rawSectionText = `${String(autoridadName || '').toUpperCase()}\nPRESENTE.\n\nEXPEDIENTE: ${expedienteNum}`;
        break;

      case 'identity':
        rawSectionText = `${quejosoName}, promoviendo en mi carácter dentro de los autos del expediente al rubro indicado, ante Usted con el debido respeto comparezco a exponer:`;
        break;

      case 'background':
        rawSectionText = `ANTECEDENTES DEL ACTO RECLAMADO Y CONSTANCIAS PROCESALES:\n\n` +
                         `BAJO PROTESTA DE DECIR VERDAD, se manifiestan los antecedentes procesales que constan en las actuaciones de origen:\n\n` +
                         (caseAnalysis?.proceduralTimeline && caseAnalysis.proceduralTimeline.length > 0
                           ? caseAnalysis.proceduralTimeline.slice(0, 5).map((e, idx) => `${idx + 1}. Con fecha ${e.date}: ${e.event}.`).join('\n\n')
                           : `1. En el expediente principal ${expedienteNum}, la autoridad responsable emitió la resolución materia del presente medio de defensa.\n\n` +
                             `2. Dicha determinación lesiona las garantías fundamentales de la parte promovente al carecer de debida fundamentación y motivación.\n\n` +
                             `3. [DATO PENDIENTE DE EXPEDIENTE: Fecha y términos de la notificación legal].`);
        break;

      case 'legal_grounds':
        rawSectionText = `PROCEDENCIA, OPORTUNIDAD Y FUNDAMENTO CONSTITUCIONAL:\n\n` +
                         `El presente medio de defensa es procedente con fundamento en los artículos 1o, 14, 16 y 17 de la Constitución Política de los Estados Unidos Mexicanos, así como en los preceptos relativos de la Ley de Amparo.\n\n` +
                         `El escrito se promueve oportunamente dentro del plazo legal previsto por la norma aplicable.`;
        break;

      case 'argument':
        rawSectionText = `${secTitleUpper}\n\n` +
                         `PLANTEAMIENTO CENTRAL:\n` +
                         `Causa agravio directo la determinación recurrida dictada por ${autoridadName}, al violentar las garantías de debido proceso, legalidad y tutela judicial efectiva.\n\n` +
                         `PARÁMETRO CONSTITUCIONAL Y CONTRASTE CON LA DECISIÓN IMPUGNADA:\n` +
                         `La autoridad resolutora sostuvo la validez del acto impugnado; sin embargo, dicho criterio resulta inconstitucional al desatender el marco de derechos humanos y la debida valoración de las constancias.\n\n` +
                         `CONSECUENCIA JURÍDICA SOLICITADA:\n` +
                         `Procede revocar o dejar insubsistente la resolución recurrida a efecto de restituir a ${quejosoName} en el goce de los derechos fundamentales conculcados.`;
        break;

      case 'evidence':
        rawSectionText = `PRUEBAS E INSTRUMENTAL DE ACTUACIONES:\n\n` +
                         `1. LA DOCUMENTAL PÚBLICA consistente en la totalidad de las actuaciones del expediente ${expedienteNum}.\n` +
                         `2. LA INSTRUMENTAL DE ACTUACIONES en todo lo que favorezca a los intereses de la parte promovente.\n` +
                         `3. LA PRESUNCIONAL LEGAL Y HUMANA.`;
        break;

      case 'petition':
        rawSectionText = `PUNTOS PETITORIOS:\n\n` +
                         `PRIMERO. Tenerme por presentado en tiempo y forma con el presente escrito y anexos acompañados.\n` +
                         `SEGUNDO. Admitir a trámite el medio de defensa promovido.\n` +
                         `TERCERO. En su oportunidad procesal, dictar resolución favorable declarando fundadas las pretensiones de esta parte.`;
        break;

      case 'closing':
        rawSectionText = `PROTESTO LO NECESARIO EN DERECHO.\nCiudad de México, a la fecha de su presentación.`;
        break;

      case 'signature':
        rawSectionText = `_________________________________________\n${quejosoName}`;
        break;

      default:
        rawSectionText = `[DESARROLLO DE SECCIÓN: ${secTitleUpper}]\n` +
                         `En relación con los autos del expediente ${expedienteNum}...`;
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
    aiError,
  };
}

export async function runGenerationPipeline(
  input: PipelineInput,
  callbacks?: PipelineCallbacks
): Promise<UniversalLegalDocument> {
  if (input.forceAiUnavailable) {
    throw new Error('Generación jurídica bloqueada: proveedor de generación no disponible.');
  }

  const sources = input.sourceDocuments || input.existingDocument?.sourceDocuments || [];
  const lawyerProfile = input.lawyerProfile || DEFAULT_LAWYER_PROFILE;

  if (sources.length > 0 && requiresValidatedSources(sources)) {
    if (!input.allowUnvalidatedSource && !input.warningMode) {
      throw new Error('La fuente no está validada. Realice o confirme la validación/OCR antes de generar el documento.');
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
      error,
    };
  };

  const fullTextFromSources = sources
    .flatMap((s) => s.pages?.map((p) => p.text) || [s.extractedText || s.content || ''])
    .join('\n\n');

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

    // Stage 2: Extract & Reconstruct Case
    updateStage('extract', 'running');
    callbacks?.onStageStart?.('extract', doc);
    
    // Reconstrucción del caso sin datos inventados
    const caseAnalysis = reconstructCaseAnalysis(sources, userPrompt, input.referenceDocumentText || '');
    (doc as any).caseAnalysis = caseAnalysis;

    doc.parties = {
      quejoso: caseAnalysis.parties.quejoso || doc.parties.quejoso,
      actor: caseAnalysis.parties.actor || doc.parties.actor,
      demandado: caseAnalysis.parties.demandado || doc.parties.demandado,
      autoridadResponsable: caseAnalysis.parties.autoridadResponsable || doc.parties.autoridadResponsable,
      terceroInteresado: caseAnalysis.parties.terceroInteresado || doc.parties.terceroInteresado,
    };

    doc.caseRefs = {
      expediente: caseAnalysis.caseNumbers.principal || doc.caseRefs.expediente,
      amparo: caseAnalysis.caseNumbers.amparoDirecto || caseAnalysis.caseNumbers.amparoIndirecto,
      toca: caseAnalysis.caseNumbers.toca,
    };

    doc.variables = buildVariableMap(doc.parties, doc.caseRefs, input.context?.variables || input.extraValues);
    updateStage('extract', 'complete');
    callbacks?.onStageComplete?.('extract', doc);

    // Stage 3: Analyze
    updateStage('analyze', 'running');
    callbacks?.onStageStart?.('analyze', doc);
    const analysisContext = buildGenerationContext({
      instruction: `Análisis procesal y fijación de teoría del caso para ${doc.documentTypeLabel}`,
      sources,
      limit: 10,
    });
    doc.generationMetadata.trace = (doc.generationMetadata.trace || []).concat({
      step: 1,
      stage: 'analyze',
      query: doc.documentTypeLabel,
      references: analysisContext.references,
      note: `Reconstruido expediente con ${caseAnalysis.proceduralTimeline.length} eventos procesales y ${sources.length} documentos fuente reales.`,
    });
    updateStage('analyze', 'complete');
    callbacks?.onStageComplete?.('analyze', doc);

    // Stage 4: Structure
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

    // Stage 5: Identify Issues, Case Theory & Drafting Plan
    updateStage('identify_issues', 'running');
    callbacks?.onStageStart?.('identify_issues', doc);
    const draftingPlan = buildDraftingPlan(doc, input.referenceDocumentText?.length || 0, caseAnalysis);
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

      const sectionIsManuallyEdited = section.isManuallyEdited || section.content?.some((b) => b.isManuallyEdited);
      if (sectionIsManuallyEdited && input.existingDocument) {
        continue;
      }

      const secPlan = draftingPlan.sections.find((p) => p.templateSectionId === section.id);
      const generated = await generateSection(
        doc,
        section.id,
        input.sectionInstruction || input.userInstruction,
        input.generateSection,
        lawyerProfile,
        secPlan,
        caseAnalysis
      );

      if (generated.aiUsed) {
        pipelineAiUsed = true;
        pipelineAiProvider = generated.aiProvider || pipelineAiProvider;
        pipelineAiModel = generated.aiModel || pipelineAiModel;
      } else if (generated.aiError) {
        pipelineAiError = generated.aiError;
      }

      const newBlock: ContentBlock = createContentBlock(
        generated.text,
        'GENERATED_ARGUMENT',
        {
          sources: generated.sources,
          isManuallyEdited: false,
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

    // Stage 7: Review Coherence
    updateStage('review_coherence', 'running');
    callbacks?.onStageStart?.('review_coherence', doc);
    if (input.referenceDocumentText) {
      const allGenText = doc.sections.flatMap((s) => s.content.map((b) => b.text)).join('\n\n');
      const styleMatch = evaluateStyleMatch(input.referenceDocumentText, allGenText);
      (doc as any).styleMatch = styleMatch;
    }
    updateStage('review_coherence', 'complete');
    callbacks?.onStageComplete?.('review_coherence', doc);

    // Stage 8: Validate & Quality Gate
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
