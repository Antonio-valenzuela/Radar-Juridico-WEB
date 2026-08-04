import { ProfessionalTemplate, TemplateCategory, TemplateSection } from './templateTypes';

const STORAGE_KEY = 'juridico_custom_templates';

export function getCustomTemplates(): ProfessionalTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProfessionalTemplate[];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(template: ProfessionalTemplate): ProfessionalTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getCustomTemplates();
    const existingIndex = current.findIndex((t) => t.id === template.id);
    let updated: ProfessionalTemplate[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = template;
    } else {
      updated = [template, ...current];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function deleteCustomTemplate(templateId: string): ProfessionalTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getCustomTemplates();
    const updated = current.filter((t) => t.id !== templateId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function createTemplateFromText(
  title: string,
  category: TemplateCategory = 'General',
  legalBasis: string = 'Fundamento a definir por el abogado',
  rawText: string
): ProfessionalTemplate {
  const id = `custom-${Date.now()}`;
  
  // Extract potential sections from common legal markers
  const sectionLines = rawText.split('\n');
  const sections: TemplateSection[] = [
    {
      id: 'autoridad_competente',
      title: 'Autoridad competente',
      type: 'text',
      required: true,
      placeholder: 'C. JUEZ DE DISTRITO EN TURNO...',
    },
    {
      id: 'quejoso_promovente',
      title: 'Promovente / Quejoso / Actor',
      type: 'text',
      required: true,
      placeholder: 'Nombre del promovente o firma',
    },
    {
      id: 'domicilio_procesal',
      title: 'Domicilio procesal',
      type: 'text',
      required: true,
      placeholder: 'Domicilio para oír y recibir notificaciones',
    },
    {
      id: 'acto_reclamado_asunto',
      title: 'Acto reclamado / Asunto principal',
      type: 'textarea',
      required: true,
      placeholder: 'Descripción del asunto o acto reclamado',
    },
    {
      id: 'hechos',
      title: 'Hechos / Antecedentes',
      type: 'repeatable',
      required: true,
      repeatLabel: 'Agregar hecho',
    },
    {
      id: 'fundamentos_conceptos',
      title: 'Fundamentos jurídicos / Conceptos de violación',
      type: 'repeatable',
      required: true,
      repeatLabel: 'Agregar concepto o argumento',
    },
    {
      id: 'pruebas',
      title: 'Pruebas ofrecidas',
      type: 'repeatable',
      required: false,
      repeatLabel: 'Agregar prueba',
    },
    {
      id: 'puntos_petitorios',
      title: 'Puntos petitorios',
      type: 'repeatable',
      required: true,
      repeatLabel: 'Agregar punto petitorio',
    },
    {
      id: 'protesta_firma',
      title: 'Lugar, fecha y firma',
      type: 'text',
      required: true,
      placeholder: 'Lugar, fecha y firma del promovente',
    },
  ];

  return {
    id,
    category,
    title,
    description: `Plantilla personalizada creada el ${new Date().toLocaleDateString('es-MX')}`,
    legalBasis: legalBasis || 'Fundamento normativo definido por el litigante.',
    applicableLaws: ['Legislación aplicable según materia'],
    warnings: ['Revisar formalidades procesales antes de presentar ante la autoridad.'],
    disclaimer: 'Plantilla personalizada del abogado. Requiere revisión profesional antes de presentarse.',
    exportFormats: ['docx', 'pdf', 'text'],
    sections,
  };
}
