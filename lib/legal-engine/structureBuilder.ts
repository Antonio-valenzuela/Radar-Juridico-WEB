import { ClassificationResult, DocumentNode, SectionType, createDocumentNode } from './types';

interface SectionTemplate {
  type: SectionType;
  title: string;
  isRepeatable?: boolean;
}

const DOCUMENT_STRUCTURES: Record<string, SectionTemplate[]> = {
  recurso_revision_amparo_directo: [
    { type: 'header', title: 'H. SEGUNDO TRIBUNAL COLEGIADO EN MATERIA DE TRABAJO DEL TERCER CIRCUITO' },
    { type: 'identity', title: 'PROEMIO E IDENTIFICACIÓN DEL RECURRENTE' },
    { type: 'legal_grounds', title: 'OPORTUNIDAD PROCESAL DEL RECURSO DE REVISIÓN' },
    { type: 'legal_grounds', title: 'INTERÉS EXCEPCIONAL' },
    { type: 'background', title: 'OBJETO DE LA IMPUGNACIÓN Y SENTENCIA DE AMPARO RECURRIDA' },
    { type: 'background', title: 'ANTECEDENTES PROCESALES DEL JUICIO LABORAL DE ORIGEN' },
    { type: 'background', title: 'ANTECEDENTE DEL PRIMER JUICIO DE AMPARO DIRECTO 226/2024' },
    { type: 'background', title: 'CUMPLIMIENTO DE LA EJECUTORIA ANTERIOR Y NUEVO LAUDO' },
    { type: 'background', title: 'EJECUTORIA RECURRIDA EN EL AMPARO DIRECTO 800/2024' },
    { type: 'legal_grounds', title: 'PROCEDENCIA DEL RECURSO DE REVISIÓN EN AMPARO DIRECTO' },
    { type: 'argument', title: 'BLOQUE DE CONSTITUCIONALIDAD' },
    { type: 'argument', title: 'VIOLACIÓN AL DEBIDO PROCESO Y TUTELA JUDICIAL EFECTIVA' },
    { type: 'argument', title: 'AGRAVIO PRIMERO', isRepeatable: true },
    { type: 'argument', title: 'SEGUNDO AGRAVIO: Desatención a la suplencia de la queja y al principio de cosa juzgada', isRepeatable: true },
    { type: 'argument', title: 'TERCER AGRAVIO: Inaplicación del control difuso de constitucionalidad y convencionalidad', isRepeatable: true },
    { type: 'argument', title: 'CUARTO AGRAVIO: Violación al principio de progresividad y derechos adquiridos', isRepeatable: true },
    { type: 'argument', title: 'QUINTO AGRAVIO: Indebida distribución de la carga probatoria en el juicio laboral', isRepeatable: true },
    { type: 'argument', title: 'CONCLUSIONES JURÍDICAS Y EFECTOS DE LA REVISIÓN' },
    { type: 'evidence', title: 'PRUEBAS E INSTRUMENTAL DE ACTUACIONES' },
    { type: 'petition', title: 'PETITORIOS' },
    { type: 'closing', title: 'PROTESTO DE LEY Y LUGAR DE PRESENTACIÓN' },
    { type: 'signature', title: 'FIRMA Y REPRESENTACIÓN' }
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
    createDocumentNode({
      id: `sec-${index + 1}`,
      type: template.type,
      title: template.title,
      order: index * 10,
      isRepeatable: template.isRepeatable,
      content: [],
    })
  );
}

/**
 * Dynamically parses a lawyer's reference machote text to extract its deep hierarchical structure tree.
 * Identifies headers, chapters, sub-headings, agravios, petitorios, closing and signature nodes.
 */
export function extractMachoteStructure(machoteText: string): DocumentNode[] {
  if (!machoteText || machoteText.trim().length < 100) {
    return buildStructure({ documentType: 'recurso_revision_amparo_directo' } as any);
  }

  const lines = machoteText.split('\n').map(l => l.trim()).filter(Boolean);
  const nodes: DocumentNode[] = [];
  let currentOrder = 0;

  const isHeadingLine = (line: string) => {
    if (line.length > 120) return false;
    if (/^(H\.|SEGUNDO|PRIMER|TRIBUNAL|SUPREMA|JUZGADO|SALA)/i.test(line) && line.length < 90) return true;
    if (/^(PROEMIO|ANTECEDENTES|OPORTUNIDAD|PROCEDENCIA|AGRAVIO|CONCEPTO|PRUEBAS|PETITORIOS|PROTESTO|FIRMA)/i.test(line)) return true;
    if (/^(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SÉPTIMO|OCTAVO|NOVENO|DÉCIMO)\b/i.test(line) && line.length < 100) return true;
    if (/^[A-ZÁÉÍÓÚÑ0-9\s\.\-:\(\)]{5,80}$/.test(line) && !line.endsWith('.')) return true;
    return false;
  };

  lines.forEach((line) => {
    if (isHeadingLine(line)) {
      let nodeType: SectionType = 'custom';
      if (/tribunal|juzgado|header|rubro/i.test(line)) nodeType = 'header';
      else if (/proemio|comparezco|identidad/i.test(line)) nodeType = 'identity';
      else if (/antecedentes|hechos|juicio|laudo/i.test(line)) nodeType = 'background';
      else if (/oportunidad|procedencia|fundamento/i.test(line)) nodeType = 'legal_grounds';
      else if (/agravio|concepto|constitucion|violacion/i.test(line)) nodeType = 'argument';
      else if (/prueba|instrumental/i.test(line)) nodeType = 'evidence';
      else if (/petitorio|puntos/i.test(line)) nodeType = 'petition';
      else if (/protesto|lugar|fecha/i.test(line)) nodeType = 'closing';
      else if (/firma|promovente/i.test(line)) nodeType = 'signature';

      // Avoid duplicate consecutive identical titles
      if (nodes.length === 0 || nodes[nodes.length - 1].title !== line) {
        currentOrder += 10;
        nodes.push(
          createDocumentNode({
            id: `sec-machote-${nodes.length + 1}`,
            type: nodeType,
            title: line,
            order: currentOrder,
            isRepeatable: nodeType === 'argument',
            content: [],
          })
        );
      }
    }
  });

  if (nodes.length < 5) {
    return buildStructure({ documentType: 'recurso_revision_amparo_directo' } as any);
  }

  return nodes;
}

export function addRepeatableSection(sections: DocumentNode[], templateId: string): DocumentNode[] {
  const templateSection = sections.find(s => s.id === templateId && s.isRepeatable);
  if (!templateSection) return sections;
  
  const newSection = createDocumentNode({
    id: `sec-repeat-${Date.now()}`,
    type: templateSection.type,
    title: `${templateSection.title} (Adicional)`,
    order: templateSection.order + 5,
    isRepeatable: true,
    content: [],
  });
  
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
