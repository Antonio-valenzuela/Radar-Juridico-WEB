export type TemplateCategory = 'Amparo' | 'Civil' | 'Familiar' | 'Mercantil' | 'Administrativo/Fiscal' | 'General';

export type TemplateFieldType = 'text' | 'textarea' | 'select' | 'repeatable' | 'date' | 'number';

export interface TemplateSection {
  id: string;
  title: string;
  type: TemplateFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  repeatLabel?: string;
  legalBasis?: string;
}

export interface ProfessionalTemplate {
  id: string;
  category: TemplateCategory;
  title: string;
  description: string;
  legalBasis: string;
  applicableLaws: string[];
  sections: TemplateSection[];
  warnings: string[];
  disclaimer: string;
  exportFormats: string[];
}

export interface AIAssistResult {
  proposedText: string;
  sourcesUsed: {
    sourceId: string;
    title: string;
    url: string;
    type: 'ley' | 'jurisprudencia';
  }[];
  pendingElements: string[];
  warnings: string[];
  confidenceLevel: 'alto' | 'medio' | 'bajo';
}

export interface RenderedDocument {
  title: string;
  header: string;
  expediente?: string;
  body: string;
  sections: {
    title: string;
    content: string | string[];
    numbered?: boolean;
  }[];
  footer: string;
  warnings: string[];
  disclaimer: string;
  generatedAt: string;
}
