export type ContentLayer = 'SOURCE_FACT' | 'COURT_REASONING' | 'USER_POSITION' | 'AI_ANALYSIS' | 'GENERATED_ARGUMENT';
export type TrustLevel = 'VERIFIED' | 'UNVERIFIED' | 'AI_INFERENCE' | 'PENDING';

export interface SourceReference {
  documentId: string;
  page?: number;
  paragraph?: number;
  textSnippet?: string;
}

export interface ContentBlock {
  id: string;
  layer: ContentLayer;
  trust?: TrustLevel;
  trustLevel?: TrustLevel;
  text: string;
  sources?: SourceReference[];
  sourceRef?: any;
  isManuallyEdited?: boolean;
  variables?: string[];
  createdAt?: string;
}

export interface DocumentVariable {
  id: string;
  name: string;
  value: string | null;
  description: string;
  isRequired: boolean;
}

export type SectionType = 'header' | 'identity' | 'background' | 'facts' | 'legal_grounds' | 'argument' | 'evidence' | 'petition' | 'closing' | 'signature' | 'annex' | 'custom';

export interface DocumentNode {
  id: string;
  type: SectionType;
  title: string;
  order: number;
  content: ContentBlock[];
  children?: DocumentNode[];
  isRepeatable: boolean;
  isEditable: boolean;
  isGenerated: boolean;
  isManuallyEdited: boolean;
  variables: string[];
  generationInstruction?: string;
  validationErrors: string[];
  validationWarnings: string[];
}

export interface DocumentParties {
  actor?: string;
  demandado?: string;
  terceroInteresado?: string;
  autoridadResponsable?: string;
  quejoso?: string;
  representanteLegal?: string;
}

export interface CaseReferences {
  expediente?: string;
  toca?: string;
  amparo?: string;
  juzgado?: string;
  tribunal?: string;
}

export interface UploadedSourceDocument {
  id: string;
  filename?: string;
  name?: string;
  type?: string;
  content?: string;
  extractedText?: string;
  classification?: any;
  uploadDate?: string;
  uploadedAt?: string;
  pages?: DocumentPage[];
  sourceValidated?: boolean;
  sourceValidationMethod?: string;
  qualityScore?: DocumentQualityScore;
  warnings?: string[];
}

export interface DocumentPage {
  page: number;
  text: string;
  chars: number;
  heading?: string;
}

export interface DocumentQualityScore {
  confidence: number;
  qualityLabel: string;
  status: 'READY' | 'NEEDS_OCR' | 'LOW_QUALITY' | 'FAILED';
  ocrUsed?: boolean;
  emptyPages?: number;
}

export interface GeneratedSourceReference extends SourceReference {
  sourceType?: 'SOURCE_FACT' | 'COURT_REASONING' | 'USER_POSITION';
  score?: number;
}

export interface PipelineTraceStep {
  step: number;
  stage: string;
  query: string;
  references: GeneratedSourceReference[];
  note: string;
}

export interface ValidationIssue {
  checkId: string;
  message: string;
  sectionId?: string;
}

export interface ValidationCheck {
  id: string;
  severity: 'error' | 'warning';
  message: string;
  evaluate: (doc: UniversalLegalDocument) => boolean;
}

export interface ValidationResult {
  isValid: boolean;
  canExport?: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  checks?: Array<{ id: string; label: string; status: 'pass' | 'fail' | 'warning' | 'pending'; message?: string }>;
}

export type PipelineStage = 'classify' | 'extract' | 'analyze' | 'structure' | 'identify_issues' | 'generate_sections' | 'review_coherence' | 'validate';

export interface PipelineStageResult {
  stage: PipelineStage;
  status: 'pending' | 'running' | 'complete' | 'error';
  startedAt?: string;
  completedAt?: string;
  error?: string;
  data?: any;
}

export interface PipelineState {
  currentStage: PipelineStage | null;
  stages: Record<PipelineStage, PipelineStageResult>;
  isComplete: boolean;
  hasErrors: boolean;
  overallStatus?: 'idle' | 'running' | 'complete' | 'error';
}

export interface GenerationMetadata {
  pipelineState: PipelineState;
  modelVersion?: string;
  promptVersion?: string;
  tokensUsed?: number;
  generationTimeMs?: number;
  trace?: PipelineTraceStep[];
}

export interface RequiredInput {
  id: string;
  label: string;
  description: string;
  type: 'text' | 'date' | 'boolean' | 'select' | 'document';
  options?: string[];
  required: boolean;
}

export interface ClassificationResult {
  documentType: string;
  documentTypeLabel: string;
  matter: string;
  jurisdiction: string;
  proceduralStage: string;
  authority?: string;
  objective: string;
  requiredInputs: RequiredInput[];
  confidence: number;
  isDynamic: boolean;
}

export interface UniversalLegalDocument {
  id: string;
  templateId?: string;
  title: string;
  documentType: string;
  documentTypeLabel: string;
  matter: string;
  jurisdiction: string;
  category: string;
  legalBasis: string[];
  parties: DocumentParties;
  caseRefs: CaseReferences;
  variables: Record<string, DocumentVariable>;
  sections: DocumentNode[];
  sourceDocuments: UploadedSourceDocument[];
  classification: ClassificationResult;
  validation: ValidationResult;
  generationMetadata: GenerationMetadata;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'generated' | 'reviewed' | 'final';
}

export function createEmptyDocument(initial: Partial<UniversalLegalDocument> = {}): UniversalLegalDocument {
  return {
    id: crypto.randomUUID(),
    title: initial.title || 'Nuevo Documento',
    documentType: initial.documentType || 'escrito_libre',
    documentTypeLabel: initial.documentTypeLabel || 'Escrito Libre',
    matter: initial.matter || 'general',
    jurisdiction: initial.jurisdiction || 'federal',
    category: initial.category || 'escrito',
    legalBasis: initial.legalBasis || [],
    parties: initial.parties || {},
    caseRefs: initial.caseRefs || {},
    variables: initial.variables || {},
    sections: initial.sections || [],
    sourceDocuments: initial.sourceDocuments || [],
    classification: initial.classification || {
      documentType: initial.documentType || 'escrito_libre',
      documentTypeLabel: initial.documentTypeLabel || 'Escrito Libre',
      matter: initial.matter || 'general',
      jurisdiction: initial.jurisdiction || 'federal',
      proceduralStage: 'general',
      objective: 'Petición judicial',
      requiredInputs: [],
      confidence: 1,
      isDynamic: true
    },
    validation: initial.validation || {
      isValid: true,
      canExport: true,
      errors: [],
      warnings: []
    },
    generationMetadata: initial.generationMetadata || {
      pipelineState: {
        currentStage: null,
        stages: {} as Record<PipelineStage, PipelineStageResult>,
        isComplete: false,
        hasErrors: false
      }
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: initial.status || 'draft',
    ...initial
  };
}

export function createDocumentNode(
  type: SectionType,
  title: string,
  order: number,
  options: Partial<DocumentNode> = {}
): DocumentNode {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    order,
    content: [],
    isRepeatable: false,
    isEditable: true,
    isGenerated: false,
    isManuallyEdited: false,
    variables: [],
    validationErrors: [],
    validationWarnings: [],
    ...options
  };
}
