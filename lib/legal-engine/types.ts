export type ContentLayer = 'SOURCE_FACT' | 'COURT_REASONING' | 'USER_POSITION' | 'AI_ANALYSIS' | 'GENERATED_ARGUMENT';
export type TrustLevel = 'VERIFIED' | 'UNVERIFIED' | 'AI_INFERENCE' | 'PENDING';

export interface SourceReference {
  documentId: string;
  page?: number;
  paragraph?: number;
  textSnippet?: string;
}

export interface BoundingBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export type DocumentBlockType =
  | 'header'
  | 'section-header'
  | 'text'
  | 'paragraph'
  | 'table'
  | 'page-footer'
  | 'page-header'
  | 'signature'
  | 'footnote'
  | 'title'
  | 'list-item'
  | 'caption'
  | string;

export interface DocumentBlock {
  id: string;
  documentId?: string;
  pageNumber: number;
  type: DocumentBlockType;
  text: string;
  bbox?: BoundingBox;
  confidence?: number;
  order: number;
  style?: BlockStyle;
  tableData?: {
    headers?: string[];
    rows?: string[][];
  };
}

export interface StructuredDocument {
  documentId?: string;
  fileName?: string;
  pageCount: number;
  pages: Array<{
    pageNumber: number;
    text: string;
    blocks: DocumentBlock[];
  }>;
  blocks: DocumentBlock[];
  parsedBy: 'nvidia-nemotron-parse' | 'native-extractor' | 'ocr';
  parsedAt: string;
}

export interface BlockStyle {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: string;
  textDecoration?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  indent?: string;
}

export interface ContentBlock {
  id: string;
  layer: ContentLayer;
  trust?: TrustLevel;
  trustLevel?: TrustLevel;
  text: string;
  style?: BlockStyle;
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
  style?: BlockStyle;
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
  style?: BlockStyle;
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
  dataUrl?: string;
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
  aiUsed?: boolean;
  aiProvider?: string | null;
  aiModel?: string | null;
  aiError?: string | null;
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
  // Style and document formatting preservation
  originalFormat?: 'pdf' | 'docx' | 'doc' | 'txt' | 'rtf' | 'custom';
  originalFileUrl?: string;
  defaultFontFamily?: string;
  defaultFontSize?: string;
  defaultLineHeight?: string;
  originalPageCount?: number;
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
      proceduralStage: 'inicial',
      objective: 'Redacción jurídica formal',
      requiredInputs: [],
      confidence: 100,
      isDynamic: false,
    },
    validation: initial.validation || {
      isValid: true,
      errors: [],
      warnings: [],
    },
    generationMetadata: initial.generationMetadata || {
      pipelineState: {
        currentStage: null,
        stages: {
          classify: { stage: 'classify', status: 'pending' },
          extract: { stage: 'extract', status: 'pending' },
          analyze: { stage: 'analyze', status: 'pending' },
          structure: { stage: 'structure', status: 'pending' },
          identify_issues: { stage: 'identify_issues', status: 'pending' },
          generate_sections: { stage: 'generate_sections', status: 'pending' },
          review_coherence: { stage: 'review_coherence', status: 'pending' },
          validate: { stage: 'validate', status: 'pending' },
        },
        isComplete: false,
        hasErrors: false,
      },
      tokensUsed: 0,
      generationTimeMs: 0,
      trace: [],
    },
    createdAt: initial.createdAt || new Date().toISOString(),
    updatedAt: initial.updatedAt || new Date().toISOString(),
    status: initial.status || 'draft',
    originalFormat: initial.originalFormat || 'custom',
    defaultFontFamily: initial.defaultFontFamily || 'Times New Roman, Times, serif',
    defaultFontSize: initial.defaultFontSize || '12pt',
    defaultLineHeight: initial.defaultLineHeight || '1.6',
    originalPageCount: initial.originalPageCount,
  };
}

export function createDocumentNode(initial: Partial<DocumentNode> & { id: string; title: string }): DocumentNode {
  return {
    id: initial.id,
    type: initial.type || 'argument',
    title: initial.title,
    order: initial.order ?? 1,
    content: initial.content || [],
    children: initial.children,
    isRepeatable: initial.isRepeatable ?? false,
    isEditable: initial.isEditable ?? true,
    isGenerated: initial.isGenerated ?? false,
    isManuallyEdited: initial.isManuallyEdited ?? false,
    variables: initial.variables || [],
    generationInstruction: initial.generationInstruction,
    validationErrors: initial.validationErrors || [],
    validationWarnings: initial.validationWarnings || [],
    style: initial.style,
  };
}

export interface CaseDocument {
  id: string;
  name: string;
  type: string;
  fileUrl?: string;
  pageCount: number;
  pages: Array<{ page: number; text: string; chars: number; ocrStatus: string; blocks?: DocumentBlock[] }>;
  structuredDocument?: StructuredDocument | null;
  role: string;
  status: 'READY' | 'NEEDS_MANUAL_REVIEW';
  uploadedAt: string;
}

export interface TemplateVersion {
  version: number;
  createdAt: string;
  title: string;
}
