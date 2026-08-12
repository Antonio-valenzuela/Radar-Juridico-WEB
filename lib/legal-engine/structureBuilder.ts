import { ClassificationResult, DocumentNode, SectionType, createDocumentNode } from './types';

interface SectionTemplate {
  type: SectionType;
  title: string;
  isRepeatable?: boolean;
}

const DOCUMENT_STRUCTURES: Record<string, SectionTemplate[]> = {
  recurso_revision_amparo_directo: [
    { type: 'header', title: 'ENCABEZADO Y RUBRO' },
    { type: 'identity', title: 'PROEMIO E IDENTIDAD' },
    { type: 'background', title: 'ANTECEDENTES DEL CASO' },
    { type: 'legal_grounds', title: 'OPORTUNIDAD Y PROCEDENCIA' },
    { type: 'argument', title: 'BLOQUE DE CONSTITUCIONALIDAD' },
    { type: 'argument', title: 'INTERÉS EXCEPCIONAL' },
    { type: 'argument', title: 'AGRAVIO PRIMERO', isRepeatable: true },
    { type: 'evidence', title: 'PRUEBAS' },
    { type: 'petition', title: 'PETITORIOS' },
    { type: 'closing', title: 'PROTESTA DE LEY' },
    { type: 'signature', title: 'FIRMA' }
  ],
  contestacion_demanda_laboral: [
    { type: 'header', title: 'Encabezado y Rubro' },
    { type: 'identity', title: 'Proemio e Identidad' },
    { type: 'background', title: 'Contestación a los Hechos' },
    { type: 'argument', title: 'Excepciones y Defensas' },
    { type: 'argument', title: 'Objeción de Pruebas' },
    { type: 'evidence', title: 'Ofrecimiento de Pruebas' },
    { type: 'petition', title: 'Puntos Petitorios' },
    { type: 'closing', title: 'Lugar y Fecha' },
    { type: 'signature', title: 'Firma' },
    { type: 'annex', title: 'Anexos' }
  ],
  demanda_amparo_indirecto: [
    { type: 'header', title: 'Encabezado y Rubro' },
    { type: 'identity', title: 'Proemio e Identidad' },
    { type: 'background', title: 'Antecedentes del Acto Reclamado' },
    { type: 'facts', title: 'Acto Reclamado y Autoridades' },
    { type: 'legal_grounds', title: 'Preceptos Constitucionales Violados' },
    { type: 'argument', title: 'Concepto de Violación', isRepeatable: true },
    { type: 'evidence', title: 'Pruebas' },
    { type: 'petition', title: 'Puntos Petitorios' },
    { type: 'closing', title: 'Lugar y Fecha' },
    { type: 'signature', title: 'Firma' }
  ],
  escrito_agravios: [
    { type: 'header', title: 'Encabezado y Rubro' },
    { type: 'identity', title: 'Proemio e Identidad' },
    { type: 'background', title: 'Resolución Impugnada' },
    { type: 'legal_grounds', title: 'Procedencia' },
    { type: 'argument', title: 'Agravio', isRepeatable: true },
    { type: 'evidence', title: 'Pruebas (Supervenientes)' },
    { type: 'petition', title: 'Puntos Petitorios' },
    { type: 'closing', title: 'Lugar y Fecha' },
    { type: 'signature', title: 'Firma' }
  ],
  contestacion_demanda: [
    { type: 'header', title: 'Encabezado y Rubro' },
    { type: 'identity', title: 'Proemio e Identidad' },
    { type: 'background', title: 'Contestación a las Prestaciones' },
    { type: 'facts', title: 'Contestación a los Hechos' },
    { type: 'argument', title: 'Excepciones y Defensas' },
    { type: 'evidence', title: 'Pruebas' },
    { type: 'petition', title: 'Puntos Petitorios' },
    { type: 'closing', title: 'Lugar y Fecha' },
    { type: 'signature', title: 'Firma' },
    { type: 'annex', title: 'Anexos' }
  ],
  escrito_cumplimiento_sentencia: [
    { type: 'header', title: 'Encabezado y Rubro' },
    { type: 'identity', title: 'Proemio e Identidad' },
    { type: 'background', title: 'Antecedentes' },
    { type: 'facts', title: 'Manifestaciones sobre el Cumplimiento' },
    { type: 'evidence', title: 'Constancias de Cumplimiento' },
    { type: 'petition', title: 'Puntos Petitorios' },
    { type: 'closing', title: 'Lugar y Fecha' },
    { type: 'signature', title: 'Firma' }
  ]
};

const GENERIC_STRUCTURE: SectionTemplate[] = [
  { type: 'header', title: 'Encabezado y Rubro' },
  { type: 'identity', title: 'Proemio e Identidad' },
  { type: 'background', title: 'Antecedentes' },
  { type: 'facts', title: 'Hechos' },
  { type: 'argument', title: 'Consideraciones Legales / Argumentos', isRepeatable: true },
  { type: 'evidence', title: 'Pruebas' },
  { type: 'petition', title: 'Puntos Petitorios' },
  { type: 'closing', title: 'Lugar y Fecha' },
  { type: 'signature', title: 'Firma' }
];

export function buildStructure(classification: ClassificationResult): DocumentNode[] {
  const structure = DOCUMENT_STRUCTURES[classification.documentType] || GENERIC_STRUCTURE;
  
  return structure.map((template, index) => 
    createDocumentNode(template.type, template.title, index * 10, { isRepeatable: template.isRepeatable })
  );
}

export function addRepeatableSection(sections: DocumentNode[], templateId: string): DocumentNode[] {
  const templateSection = sections.find(s => s.id === templateId && s.isRepeatable);
  if (!templateSection) return sections;
  
  const newSection = createDocumentNode(templateSection.type, `${templateSection.title} (Adicional)`, templateSection.order + 5, { isRepeatable: true });
  
  const result = [...sections];
  const insertIndex = result.findIndex(s => s.id === templateId) + 1;
  result.splice(insertIndex, 0, newSection);
  
  return result.map((s, i) => ({ ...s, order: i * 10 }));
}

export function removeSection(sections: DocumentNode[], sectionId: string): DocumentNode[] {
  return sections.filter(s => s.id !== sectionId).map((s, i) => ({ ...s, order: i * 10 }));
}

export function moveSection(sections: DocumentNode[], sectionId: string, direction: 'up' | 'down'): DocumentNode[] {
  const index = sections.findIndex(s => s.id === sectionId);
  if (index === -1) return sections;
  if (direction === 'up' && index === 0) return sections;
  if (direction === 'down' && index === sections.length - 1) return sections;
  
  const result = [...sections];
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  
  const temp = result[index];
  result[index] = result[swapIndex];
  result[swapIndex] = temp;
  
  return result.map((s, i) => ({ ...s, order: i * 10 }));
}

export function getKnownDocumentTypes(): string[] {
  return Object.keys(DOCUMENT_STRUCTURES);
}
