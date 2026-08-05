import { adminFetch } from '@/lib/client/adminToken';
import { ProfessionalTemplate, TemplateCategory, TemplateFieldDefinition, TemplateStructure } from './templateTypes';

const STORAGE_KEY = 'juridico_custom_templates';

function normalizeFieldType(type: string): TemplateFieldDefinition['type'] {
  const normalized = String(type || '').trim().toLowerCase();
  if (['lista', 'list', 'repeatable'].includes(normalized)) return 'repeatable';
  if (['texto', 'text', 'string'].includes(normalized)) return 'text';
  if (['textarea', 'area', 'paragraph', 'texto_largo'].includes(normalized)) return 'textarea';
  if (['select', 'dropdown', 'opcion'].includes(normalized)) return 'select';
  if (normalized === 'date') return 'date';
  if (normalized === 'number' || normalized === 'numeric') return 'number';
  return 'text';
}

function buildSectionsFromStructure(structure: TemplateStructure) {
  return structure.campos.map((field) => ({
    id: field.id,
    title: field.etiqueta,
    type: normalizeFieldType(field.tipo),
    required: field.obligatorio,
    placeholder: field.placeholder,
    helpText: field.helpText,
    options: field.options,
    repeatLabel: field.repeatLabel,
  }));
}

function getLocalCustomTemplates(): ProfessionalTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProfessionalTemplate[];
  } catch {
    return [];
  }
}

function saveCustomTemplateLocally(template: ProfessionalTemplate): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalCustomTemplates();
    const existingIndex = current.findIndex((t) => t.id === template.id);
    const updated = existingIndex >= 0 ? [...current.slice(0, existingIndex), template, ...current.slice(existingIndex + 1)] : [template, ...current];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export async function getCustomTemplates(): Promise<ProfessionalTemplate[]> {
  if (typeof window === 'undefined') return [];
  try {
    const response = await adminFetch('/api/templates/custom');
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Error al leer las plantillas.');
    }
    const templates = (payload.templates as ProfessionalTemplate[]).map((template) => {
      if ((!template.sections || template.sections.length === 0) && template.structureJson?.campos?.length) {
        return {
          ...template,
          sections: buildSectionsFromStructure(template.structureJson),
        };
      }
      return template;
    });
    return templates;
  } catch {
    return getLocalCustomTemplates();
  }
}

export async function saveCustomTemplate(template: ProfessionalTemplate): Promise<ProfessionalTemplate> {
  if (typeof window === 'undefined') return template;
  try {
    const response = await adminFetch('/api/templates/custom', {
      method: 'POST',
      body: JSON.stringify({
        title: template.title,
        category: template.category,
        legalBasis: template.legalBasis,
        documentType: template.documentType || 'documento_juridico',
        description: template.description,
        applicableLaws: template.applicableLaws,
        warnings: template.warnings,
        disclaimer: template.disclaimer,
        exportFormats: template.exportFormats,
        structureJson: template.structureJson,
        originalText: template.originalText,
        sourceFileName: template.sourceFileName,
        content: template.originalText || '',
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Error en la respuesta del servidor.');
    }
    const saved = payload.template as ProfessionalTemplate;
    const templateWithSections = !saved.sections?.length && saved.structureJson?.campos?.length
      ? { ...saved, sections: buildSectionsFromStructure(saved.structureJson) }
      : saved;
    saveCustomTemplateLocally(templateWithSections);
    return templateWithSections;
  } catch {
    saveCustomTemplateLocally(template);
    return template;
  }
}

export async function updateCustomTemplate(
  templateId: string,
  patchData: Partial<ProfessionalTemplate> & { content?: string }
): Promise<ProfessionalTemplate> {
  if (typeof window === 'undefined') throw new Error('Operación no disponible en servidor.');
  try {
    const response = await adminFetch(`/api/templates/custom/${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: patchData.title,
        category: patchData.category,
        legalBasis: patchData.legalBasis,
        description: patchData.description,
        content: patchData.content || patchData.originalText,
        originalText: patchData.originalText,
        applicableLaws: patchData.applicableLaws,
        warnings: patchData.warnings,
        disclaimer: patchData.disclaimer,
        exportFormats: patchData.exportFormats,
        structureJson: patchData.structureJson,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Error al actualizar la plantilla.');
    }
    const updated = payload.template as ProfessionalTemplate;
    const templateWithSections = !updated.sections?.length && updated.structureJson?.campos?.length
      ? { ...updated, sections: buildSectionsFromStructure(updated.structureJson) }
      : updated;
    saveCustomTemplateLocally(templateWithSections);
    return templateWithSections;
  } catch (err: any) {
    // Local fallback update
    const current = getLocalCustomTemplates();
    const existing = current.find((t) => t.id === templateId);
    if (!existing) throw err;
    const merged: ProfessionalTemplate = {
      ...existing,
      ...patchData,
      updatedAt: new Date().toISOString(),
    };
    saveCustomTemplateLocally(merged);
    return merged;
  }
}

export async function deleteCustomTemplate(templateId: string): Promise<ProfessionalTemplate[]> {
  if (typeof window === 'undefined') return [];
  try {
    const response = await adminFetch(`/api/templates/custom/${templateId}`, {
      method: 'DELETE',
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Error al eliminar la plantilla.');
    }
    const templates = payload.templates as ProfessionalTemplate[];
    if (templates) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    }
    return templates;
  } catch {
    const current = getLocalCustomTemplates();
    const updated = current.filter((template) => template.id !== templateId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  }
}

export function buildTemplateFromStructure(
  title: string,
  category: TemplateCategory = 'General',
  legalBasis: string = 'Fundamento a definir por el abogado',
  structure: TemplateStructure,
  originalText: string,
  sourceFileName?: string
): ProfessionalTemplate {
  const id = `custom-${Date.now()}`;
  const sections = buildSectionsFromStructure(structure);

  return {
    id,
    category,
    title,
    description: `Plantilla personalizada generada el ${new Date().toLocaleDateString('es-MX')}`,
    legalBasis: legalBasis || 'Fundamento normativo definido por el litigante.',
    documentType: structure.tipo_documento || 'documento_juridico',
    applicableLaws: ['Legislación aplicable según materia'],
    warnings: ['Revisar formalidades procesales antes de presentar ante la autoridad.'],
    disclaimer: 'Plantilla personalizada del abogado. Requiere revisión profesional antes de presentarse.',
    exportFormats: ['docx', 'pdf', 'text'],
    structureJson: structure,
    sections,
    originalText,
    sourceFileName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}


type SectionDef = {
  id: string;
  title: string;
  type: 'text' | 'textarea' | 'repeatable';
  required: boolean;
  placeholder?: string;
  repeatLabel?: string;
};

const CATEGORY_SECTIONS: Record<TemplateCategory, SectionDef[]> = {
  Amparo: [
    { id: 'autoridad', title: 'Autoridad responsable', type: 'text', required: true, placeholder: 'C. JUEZ DE DISTRITO EN TURNO...' },
    { id: 'quejoso', title: 'Quejoso / Promovente', type: 'text', required: true, placeholder: 'Nombre completo del quejoso o firma' },
    { id: 'domicilio', title: 'Domicilio procesal', type: 'text', required: true, placeholder: 'Domicilio para oír y recibir notificaciones' },
    { id: 'acto_reclamado', title: 'Acto reclamado', type: 'textarea', required: true, placeholder: 'Descripción del acto o actos reclamados' },
    { id: 'garantias_violadas', title: 'Derechos / Garantías violadas', type: 'repeatable', required: true, repeatLabel: 'Agregar garantía violada' },
    { id: 'hechos', title: 'Hechos y antecedentes', type: 'repeatable', required: true, repeatLabel: 'Agregar hecho' },
    { id: 'conceptos_violacion', title: 'Conceptos de violación', type: 'repeatable', required: true, repeatLabel: 'Agregar concepto de violación' },
    { id: 'pruebas', title: 'Pruebas ofrecidas', type: 'repeatable', required: false, repeatLabel: 'Agregar prueba' },
    { id: 'puntos_petitorios', title: 'Puntos petitorios', type: 'repeatable', required: true, repeatLabel: 'Agregar punto petitorio' },
    { id: 'firma', title: 'Lugar, fecha y firma', type: 'text', required: true, placeholder: 'Lugar, fecha y firma del quejoso' },
  ],
  Civil: [
    { id: 'autoridad', title: 'Autoridad / Juzgado', type: 'text', required: true, placeholder: 'C. JUEZ CIVIL EN TURNO...' },
    { id: 'actor', title: 'Actor / Demandante', type: 'text', required: true, placeholder: 'Nombre del actor o firma' },
    { id: 'demandado', title: 'Demandado', type: 'text', required: true, placeholder: 'Nombre del demandado' },
    { id: 'domicilio', title: 'Domicilio procesal', type: 'text', required: true, placeholder: 'Domicilio para notificaciones' },
    { id: 'prestaciones', title: 'Prestaciones reclamadas', type: 'repeatable', required: true, repeatLabel: 'Agregar prestación' },
    { id: 'hechos', title: 'Hechos', type: 'repeatable', required: true, repeatLabel: 'Agregar hecho' },
    { id: 'fundamentos', title: 'Fundamentos de derecho', type: 'repeatable', required: true, repeatLabel: 'Agregar fundamento' },
    { id: 'pruebas', title: 'Pruebas ofrecidas', type: 'repeatable', required: false, repeatLabel: 'Agregar prueba' },
    { id: 'puntos_petitorios', title: 'Puntos petitorios', type: 'repeatable', required: true, repeatLabel: 'Agregar punto petitorio' },
    { id: 'firma', title: 'Lugar, fecha y firma', type: 'text', required: true, placeholder: 'Lugar, fecha y firma' },
  ],
  Familiar: [
    { id: 'autoridad', title: 'Juzgado familiar', type: 'text', required: true, placeholder: 'C. JUEZ FAMILIAR EN TURNO...' },
    { id: 'partes', title: 'Partes', type: 'text', required: true, placeholder: 'Nombres de las partes involucradas' },
    { id: 'domicilio', title: 'Domicilio procesal', type: 'text', required: true, placeholder: 'Domicilio para notificaciones' },
    { id: 'tipo_juicio', title: 'Tipo de juicio / Asunto', type: 'text', required: true, placeholder: 'Divorcio / Guarda y custodia / Alimentos...' },
    { id: 'hechos', title: 'Hechos', type: 'repeatable', required: true, repeatLabel: 'Agregar hecho' },
    { id: 'fundamentos', title: 'Fundamentos de derecho', type: 'repeatable', required: true, repeatLabel: 'Agregar fundamento' },
    { id: 'pruebas', title: 'Pruebas ofrecidas', type: 'repeatable', required: false, repeatLabel: 'Agregar prueba' },
    { id: 'puntos_petitorios', title: 'Puntos petitorios', type: 'repeatable', required: true, repeatLabel: 'Agregar punto petitorio' },
    { id: 'firma', title: 'Lugar, fecha y firma', type: 'text', required: true, placeholder: 'Lugar, fecha y firma' },
  ],
  Mercantil: [
    { id: 'autoridad', title: 'Juzgado mercantil', type: 'text', required: true, placeholder: 'C. JUEZ MERCANTIL EN TURNO...' },
    { id: 'actor', title: 'Actor / Demandante', type: 'text', required: true, placeholder: 'Nombre del actor o empresa' },
    { id: 'demandado', title: 'Demandado', type: 'text', required: true, placeholder: 'Nombre del demandado o empresa' },
    { id: 'domicilio', title: 'Domicilio procesal', type: 'text', required: true, placeholder: 'Domicilio para notificaciones' },
    { id: 'obligacion', title: 'Obligación incumplida', type: 'textarea', required: true, placeholder: 'Descripción de la obligación incumplida o controversia' },
    { id: 'hechos', title: 'Hechos', type: 'repeatable', required: true, repeatLabel: 'Agregar hecho' },
    { id: 'fundamentos', title: 'Fundamentos de derecho', type: 'repeatable', required: true, repeatLabel: 'Agregar fundamento' },
    { id: 'pruebas', title: 'Pruebas ofrecidas', type: 'repeatable', required: false, repeatLabel: 'Agregar prueba' },
    { id: 'puntos_petitorios', title: 'Puntos petitorios', type: 'repeatable', required: true, repeatLabel: 'Agregar punto petitorio' },
    { id: 'firma', title: 'Lugar, fecha y firma', type: 'text', required: true, placeholder: 'Lugar, fecha y firma' },
  ],
  'Administrativo/Fiscal': [
    { id: 'autoridad', title: 'Autoridad administrativa / fiscal', type: 'text', required: true, placeholder: 'Nombre del órgano o autoridad' },
    { id: 'promovente', title: 'Promovente', type: 'text', required: true, placeholder: 'Nombre o razón social del contribuyente / promovente' },
    { id: 'domicilio', title: 'Domicilio fiscal / procesal', type: 'text', required: true, placeholder: 'Domicilio para notificaciones' },
    { id: 'acto_impugnado', title: 'Acto impugnado', type: 'textarea', required: true, placeholder: 'Resolución o acto que se impugna (número, fecha, autoridad emisora)' },
    { id: 'agravios', title: 'Agravios / Conceptos de impugnación', type: 'repeatable', required: true, repeatLabel: 'Agregar agravio' },
    { id: 'pruebas', title: 'Pruebas ofrecidas', type: 'repeatable', required: false, repeatLabel: 'Agregar prueba' },
    { id: 'puntos_petitorios', title: 'Puntos petitorios', type: 'repeatable', required: true, repeatLabel: 'Agregar punto petitorio' },
    { id: 'firma', title: 'Lugar, fecha y firma', type: 'text', required: true, placeholder: 'Lugar, fecha y firma' },
  ],
  General: [
    { id: 'autoridad', title: 'Autoridad / Destinatario', type: 'text', required: true, placeholder: 'Autoridad o persona a quien va dirigido' },
    { id: 'promovente', title: 'Promovente', type: 'text', required: true, placeholder: 'Nombre del promovente o firma' },
    { id: 'domicilio', title: 'Domicilio procesal', type: 'text', required: true, placeholder: 'Domicilio para notificaciones' },
    { id: 'asunto', title: 'Asunto', type: 'textarea', required: true, placeholder: 'Descripción concisa del asunto' },
    { id: 'hechos', title: 'Hechos / Antecedentes', type: 'repeatable', required: true, repeatLabel: 'Agregar hecho' },
    { id: 'fundamentos', title: 'Fundamentos de derecho', type: 'repeatable', required: true, repeatLabel: 'Agregar fundamento' },
    { id: 'pruebas', title: 'Pruebas ofrecidas', type: 'repeatable', required: false, repeatLabel: 'Agregar prueba' },
    { id: 'puntos_petitorios', title: 'Puntos petitorios', type: 'repeatable', required: true, repeatLabel: 'Agregar punto petitorio' },
    { id: 'firma', title: 'Lugar, fecha y firma', type: 'text', required: true, placeholder: 'Lugar, fecha y firma' },
  ],
};

export function createTemplateFromText(
  title: string,
  category: TemplateCategory = 'General',
  legalBasis: string = 'Fundamento a definir por el abogado',
  rawText: string
): ProfessionalTemplate {
  const id = `custom-${Date.now()}`;
  const defs = CATEGORY_SECTIONS[category] ?? CATEGORY_SECTIONS.General;

  const sections = defs.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    required: d.required,
    placeholder: d.placeholder,
    repeatLabel: d.repeatLabel,
  }));

  return {
    id,
    category,
    title,
    description: `Plantilla personalizada creada el ${new Date().toLocaleDateString('es-MX')}`,
    legalBasis: legalBasis || 'Fundamento normativo definido por el litigante.',
    documentType: 'documento_juridico',
    applicableLaws: ['Legislación aplicable según materia'],
    warnings: ['Revisar formalidades procesales antes de presentar ante la autoridad.'],
    disclaimer: 'Plantilla personalizada del abogado. Requiere revisión profesional antes de presentarse.',
    exportFormats: ['docx', 'pdf', 'text'],
    structureJson: {
      nombre: title,
      tipo_documento: 'documento_juridico',
      campos: sections.map((s) => ({
        id: s.id,
        etiqueta: s.title,
        tipo: s.type,
        obligatorio: s.required,
        placeholder: s.placeholder,
        repeatLabel: s.repeatLabel,
      })),
    },
    sections,
    originalText: rawText,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

