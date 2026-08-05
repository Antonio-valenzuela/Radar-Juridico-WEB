import { z } from 'zod';
import { templates } from './templateDefinitions';
import { validateTemplateValues } from './templateRenderer';
import type { ProfessionalTemplate, TemplateSection, TemplateStructure } from './templateTypes';

export interface FastReviewResponse {
  estado: 'ok' | 'missing_fields' | 'format_errors' | 'needs_review';
  camposFaltantes: string[];
  erroresFormato: string[];
  recomendaciones: string[];
}

export interface DeepReviewResponse {
  revisionLegal: string;
  revisionRedaccion: string;
  revisionProcesal: string;
  riesgos: string[];
}

export const TemplateStructureSchema = z.object({
  nombre: z.string(),
  tipo_documento: z.string(),
  campos: z.array(
    z.object({
      id: z.string(),
      etiqueta: z.string(),
      tipo: z.enum(['text', 'textarea', 'select', 'repeatable', 'list', 'date', 'number']),
      obligatorio: z.boolean(),
      placeholder: z.string().optional(),
      helpText: z.string().optional(),
      options: z.array(z.string()).optional(),
      repeatLabel: z.string().optional(),
    })
  ),
});

export function buildSectionsFromStructureJson(structure: TemplateStructure): TemplateSection[] {
  return structure.campos.map((campo) => ({
    id: campo.id,
    title: campo.etiqueta,
    type: normalizeFieldType(campo.tipo),
    required: campo.obligatorio,
    placeholder: campo.placeholder,
    helpText: campo.helpText,
    options: campo.options,
    repeatLabel: campo.repeatLabel,
  }));
}

function normalizeFieldType(type: string): TemplateSection['type'] {
  const normalized = String(type || '').trim().toLowerCase();
  if (['textarea', 'area', 'paragraph', 'texto_largo'].includes(normalized)) return 'textarea';
  if (['number', 'numeric', 'numero'].includes(normalized)) return 'number';
  if (['date', 'fecha'].includes(normalized)) return 'date';
  if (['select', 'dropdown', 'opcion'].includes(normalized)) return 'select';
  if (['repeatable', 'lista', 'list'].includes(normalized)) return 'repeatable';
  return 'text';
}

export function resolveTemplateForReview(
  templateId: string,
  structureJson?: TemplateStructure
): ProfessionalTemplate | null {
  const found = templates.find((template) => template.id === templateId);
  if (found) return found;
  if (!structureJson) return null;
  return {
    id: templateId,
    category: 'General',
    title: structureJson.nombre || `Plantilla ${templateId}`,
    description: `Plantilla generada a partir de la estructura recibida.`,
    legalBasis: '',
    documentType: structureJson.tipo_documento || 'documento_juridico',
    applicableLaws: [],
    warnings: [],
    disclaimer: 'Documento generado a partir de la estructura proporcionada. Requiere revisión profesional antes de usar.',
    exportFormats: ['docx', 'pdf', 'text'],
    structureJson,
    sections: buildSectionsFromStructureJson(structureJson),
  };
}

export function validateValuesAgainstTemplate(
  template: ProfessionalTemplate,
  values: Record<string, any>
) {
  const validation = validateTemplateValues(template, values);
  const camposFaltantes = validation.missingFields.map((field) => field.title);
  const erroresFormato: string[] = [];

  template.sections.forEach((section) => {
    const rawValue = values[section.id];
    const value = Array.isArray(rawValue)
      ? rawValue.filter((item) => String(item || '').trim().length > 0)
      : rawValue;

    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      return;
    }

    if (section.type === 'date' && typeof value === 'string') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value.trim())) {
        erroresFormato.push(`El campo "${section.title}" debe estar en formato YYYY-MM-DD.`);
      }
    }

    if (section.type === 'number' && typeof value === 'string') {
      if (value.trim().length === 0 || Number.isNaN(Number(value))) {
        erroresFormato.push(`El campo "${section.title}" debe ser un número válido.`);
      }
    }

    if (section.type === 'repeatable' && !Array.isArray(rawValue)) {
      erroresFormato.push(`El campo "${section.title}" debe enviarse como una lista de elementos.`);
    }

    if (section.type === 'select' && section.options?.length && typeof value === 'string') {
      if (!section.options.includes(value)) {
        erroresFormato.push(`El campo "${section.title}" debe ser una de las opciones válidas.`);
      }
    }
  });

  const recomendaciones: string[] = [];
  if (camposFaltantes.length > 0) {
    recomendaciones.push(`Completa los campos obligatorios: ${camposFaltantes.join(', ')}.`);
  }
  if (erroresFormato.length > 0) {
    recomendaciones.push('Corrige los formatos de los campos señalados antes de generar el documento.');
  }
  recomendaciones.push('Verifica que los hechos y los puntos petitorios sean coherentes entre sí.');
  recomendaciones.push('Asegúrate de que la autoridad competente y el expediente correspondan al trámite.');

  return {
    camposFaltantes,
    erroresFormato,
    recomendaciones,
    estado: camposFaltantes.length > 0 ? 'missing_fields' : erroresFormato.length > 0 ? 'format_errors' : 'ok',
  };
}
