import { 
  UniversalLegalDocument, 
  PipelineStage, 
  createEmptyDocument, 
  DocumentParties,
  CaseReferences,
  ContentBlock
} from './types';
import { classifyIntent } from './classifier';
import { buildStructure } from './structureBuilder';
import { buildVariableMap } from './variableResolver';
import { validateDocument } from './validator';

export interface PipelineInput {
  prompt?: string;
  userInstruction?: string;
  sourceDocuments?: any[];
  context?: Record<string, any>;
  existingClassification?: any;
  extraValues?: Record<string, string>;
  targetSection?: string;
  sectionInstruction?: string;
}

export interface PipelineCallbacks {
  onStageStart?: (stage: PipelineStage, doc: UniversalLegalDocument) => void;
  onStageComplete?: (stage: PipelineStage, doc: UniversalLegalDocument) => void;
  onError?: (error: any, stage: PipelineStage, doc: UniversalLegalDocument) => void;
}

export function extractPartiesFromText(text: string): DocumentParties {
  const parties: DocumentParties = {};
  const qMatch = text.match(/(?:quejoso|actor)s?:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)(?:,|;|\n|$)/i);
  if (qMatch) parties.quejoso = qMatch[1].trim();
  
  const dMatch = text.match(/(?:demandado|responsable)s?:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)(?:,|;|\n|$)/i);
  if (dMatch) parties.demandado = dMatch[1].trim();
  
  return parties;
}

export function extractCaseRefsFromText(text: string): CaseReferences {
  const refs: CaseReferences = {};
  const expMatch = text.match(/(?:expediente|juicio|amparo)\s*:?\s*(\d+[\/\-]\d+)/i);
  if (expMatch) refs.expediente = expMatch[1].trim();
  
  return refs;
}

export function generateSection(
  doc: UniversalLegalDocument,
  sectionId: string,
  instruction?: string
): { text: string; warnings: string[] } {
  const sec = doc.sections.find(s => s.id === sectionId);
  if (!sec) return { text: '', warnings: ['Sección no encontrada'] };

  return {
    text: `[SECCIÓN GENERADA: ${sec.title}]\n${instruction ? `Instrucción: ${instruction}\n` : ''}En atención a lo solicitado...`,
    warnings: []
  };
}

export async function runGenerationPipeline(
  input: PipelineInput,
  callbacks?: PipelineCallbacks
): Promise<UniversalLegalDocument> {
  const doc = createEmptyDocument();
  const userPrompt = input.userInstruction || input.prompt || '';
  if (input.sourceDocuments) {
    doc.sourceDocuments = input.sourceDocuments;
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
  
  try {
    // Stage 1: Classify
    updateStage('classify', 'running');
    callbacks?.onStageStart?.('classify', doc);
    doc.classification = input.existingClassification || classifyIntent(userPrompt);
    doc.documentType = doc.classification.documentType;
    doc.documentTypeLabel = doc.classification.documentTypeLabel;
    doc.title = `${doc.documentTypeLabel} - ${new Date().toLocaleDateString('es-MX')}`;
    updateStage('classify', 'complete');
    callbacks?.onStageComplete?.('classify', doc);
    
    // Stage 2: Extract
    updateStage('extract', 'running');
    callbacks?.onStageStart?.('extract', doc);
    doc.parties = extractPartiesFromText(userPrompt);
    doc.caseRefs = extractCaseRefsFromText(userPrompt);
    doc.variables = buildVariableMap(doc.parties, doc.caseRefs, input.context?.variables || input.extraValues);
    updateStage('extract', 'complete');
    callbacks?.onStageComplete?.('extract', doc);
    
    // Stage 3: Analyze
    updateStage('analyze', 'running');
    callbacks?.onStageStart?.('analyze', doc);
    // Placeholder for deeper analysis of source documents
    updateStage('analyze', 'complete');
    callbacks?.onStageComplete?.('analyze', doc);
    
    // Stage 4: Structure
    updateStage('structure', 'running');
    callbacks?.onStageStart?.('structure', doc);
    doc.sections = buildStructure(doc.classification);
    updateStage('structure', 'complete');
    callbacks?.onStageComplete?.('structure', doc);
    
    // Stage 5: Identify Issues
    updateStage('identify_issues', 'running');
    callbacks?.onStageStart?.('identify_issues', doc);
    // Placeholder for issue spotting logic
    updateStage('identify_issues', 'complete');
    callbacks?.onStageComplete?.('identify_issues', doc);
    
    // Stage 6: Generate Sections
    updateStage('generate_sections', 'running');
    callbacks?.onStageStart?.('generate_sections', doc);
    for (const section of doc.sections) {
      if (section.type !== 'signature') {
        // We do not actually await fetch in this mock, we just setup the structure.
        // In reality, this would call generateSection.
        section.content = [];
        section.isGenerated = true;
      }
    }
    updateStage('generate_sections', 'complete');
    callbacks?.onStageComplete?.('generate_sections', doc);
    
    // Stage 7: Review Coherence
    updateStage('review_coherence', 'running');
    callbacks?.onStageStart?.('review_coherence', doc);
    // Placeholder for coherence check
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
