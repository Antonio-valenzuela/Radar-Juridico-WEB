import { ProfessionalTemplate, RenderedDocument } from './templateTypes';
import { DRAFT_WARNING, hasPendingMarkers } from './templateQuality';

export interface TemplateValidationResult {
  valid: boolean;
  missingFieldIds: string[];
  missingFields: Array<{ id: string; title: string }>;
}

const hasMeaningfulValue = (value: string | string[] | undefined): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => item.trim().length > 0);
  }
  return typeof value === 'string' && value.trim().length > 0;
};

export const validateTemplateValues = (
  template: ProfessionalTemplate,
  values: Record<string, string | string[]>
): TemplateValidationResult => {
  const missingFields = template.sections
    .filter((section) => section.required && !hasMeaningfulValue(values[section.id]))
    .map((section) => ({ id: section.id, title: section.title }));

  return {
    valid: missingFields.length === 0,
    missingFieldIds: missingFields.map((field) => field.id),
    missingFields,
  };
};

const numberToOrdinal = (num: number): string => {
  const ordinals = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO', 'DÉCIMO PRIMERO', 'DÉCIMO SEGUNDO', 'DÉCIMO TERCERO', 'DÉCIMO CUARTO', 'DÉCIMO QUINTO', 'DÉCIMO SEXTO', 'DÉCIMO SÉPTIMO', 'DÉCIMO OCTAVO', 'DÉCIMO NOVENO', 'VIGÉSIMO'];
  return ordinals[num - 1] || `${num}º`;
};

export const renderToDocument = (
  template: ProfessionalTemplate,
  values: Record<string, string | string[]>
): RenderedDocument => {
  const getVal = (id: string, label: string, isArray: boolean = false) => {
    const val = values[id];
    if (isArray) {
      const items = (Array.isArray(val) ? val : val ? [val] : [])
        .map((item) => item.trim())
        .filter(Boolean);
      return items.length > 0 ? items : [`[PENDIENTE: ${label}]`];
    }
    if (!val || (typeof val === 'string' && val.trim().length === 0)) {
      return `[PENDIENTE: ${label}]`;
    }
    return Array.isArray(val) ? val.join(', ') : val;
  };

  const doc: RenderedDocument = {
    title: template.title,
    header: '',
    expediente: getVal('expediente', 'Expediente') as string,
    body: '',
    sections: [],
    footer: '',
    warnings: template.warnings,
    disclaimer: template.disclaimer,
    generatedAt: new Date().toISOString()
  };

  const auth = getVal('autoridad_competente', 'Autoridad competente');
  const exp = values['expediente'] ? `EXPEDIENTE: ${values['expediente']}` : '';
  const tipo = values['tipo_procedimiento'] ? `ASUNTO: ${values['tipo_procedimiento']}` : '';

  const actorName = values['actor'] || values['quejoso'] || values['promovente'] || '';
  const actor = actorName ? `${actorName}` : '';

  const vsVal =
    values['demandado'] ||
    values['contraparte'] ||
    values['autoridades_responsables'];
  const vs = vsVal ? `VS\n${Array.isArray(vsVal) ? vsVal[0] : vsVal}` : '';

  doc.header = `${auth}\nPRESENTE.\n\n`;
  if (exp) doc.header += `${exp}\n`;
  if (tipo) doc.header += `${tipo}\n`;
  if (actor) doc.header += `${actor}\n`;
  if (vs) doc.header += `${vs}\n`;

  let intro = '';
  if (actorName) {
    intro += `${actorName}`;
    if (values['personalidad']) intro += `, ${values['personalidad']}`;
    if (values['domicilio_procesal']) intro += `, señalando como domicilio procesal el ubicado en ${values['domicilio_procesal']}`;
    if (values['personas_autorizadas']) {
      const auths = Array.isArray(values['personas_autorizadas']) ? values['personas_autorizadas'].join(', ') : values['personas_autorizadas'];
      intro += `, y autorizando para oír y recibir notificaciones a ${auths}`;
    }
    intro += `, ante Usted con el debido respeto comparezco y expongo:\n`;
  } else if (values['promoventes']) {
    intro += `${values['promoventes']}`;
    if (values['personalidad']) intro += `, ${values['personalidad']}`;
    if (values['domicilio_procesal']) {
      intro += `, señalando como domicilio procesal el ubicado en ${values['domicilio_procesal']}`;
    }
    if (values['personas_autorizadas']) {
      const auths = Array.isArray(values['personas_autorizadas'])
        ? values['personas_autorizadas'].join(', ')
        : values['personas_autorizadas'];
      intro += `, y autorizando para oír y recibir notificaciones a ${auths}`;
    }
    intro += ', ante Usted con el debido respeto comparecemos y exponemos:\n';
  }

  if (values['cuerpo_escrito']) {
    intro += `\n${values['cuerpo_escrito']}\n`;
  }

  doc.body = intro;

  const excludedFromSections = [
    'autoridad_competente', 'expediente', 'tipo_procedimiento', 'actor', 'quejoso',
    'promovente', 'promoventes', 'personalidad', 'domicilio_procesal', 'personas_autorizadas',
    'cuerpo_escrito', 'protesta', 'lugar_fecha', 'firma', 'lista_anexos', 'puntos_petitorios', 'firmas'
  ];

  for (const sec of template.sections) {
    if (excludedFromSections.includes(sec.id)) {
      continue;
    }

    const val = getVal(sec.id, sec.title, sec.type === 'repeatable');
    doc.sections.push({
      title: sec.title.toUpperCase(),
      content: val,
      numbered: [
        'hechos',
        'pruebas',
        'conceptos_violacion',
        'agravios',
        'prestaciones',
        'contestacion_prestaciones',
        'contestacion_hechos',
        'clausulas',
      ].includes(sec.id)
    });
  }

  const validation = validateTemplateValues(template, values);
  if (!validation.valid) {
    doc.sections.unshift({
      title: 'DATOS OBLIGATORIOS PENDIENTES',
      content: validation.missingFields.map(
        (field) => `[PENDIENTE: ${field.title}]`
      ),
      numbered: false,
    });
  }

  const petitoriosVal = getVal('puntos_petitorios', 'Puntos petitorios', true) as string[];
  doc.sections.push({
    title: 'PUNTOS PETITORIOS',
    content: petitoriosVal,
    numbered: true
  });

  let footerStr = '';
  const protesta = getVal('protesta', 'Protesta');
  const lugarFecha = getVal('lugar_fecha', 'Lugar y fecha');
  const firma = getVal('firma', 'Firma');

  footerStr += `\n${protesta}\n\n`;
  footerStr += `${lugarFecha}\n\n\n`;

  if (values['firmas']) {
      footerStr += `${values['firmas']}\n`;
  } else {
      footerStr += `___________________________\n${firma}\n`;
  }

  if (values['lista_anexos']) {
    const anexos = Array.isArray(values['lista_anexos']) ? values['lista_anexos'] : [values['lista_anexos']];
    footerStr += `\nANEXOS:\n`;
    anexos.forEach((a, i) => {
      footerStr += `${i + 1}. ${a}\n`;
    });
  }

  doc.footer = footerStr;

  const pendingMetadata = [
    template.legalBasis,
    ...template.applicableLaws,
    ...template.warnings,
  ].filter((value) => hasPendingMarkers(value));
  const documentHasPendingMarkers = hasPendingMarkers([
    doc.header,
    doc.body,
    doc.sections.map((section) => section.content),
    doc.footer,
  ]);

  doc.sections.unshift({
    title: DRAFT_WARNING,
    content: pendingMetadata.length > 0 || documentHasPendingMarkers
      ? (pendingMetadata.length > 0 ? pendingMetadata : 'Este documento conserva campos jurídicos pendientes de validar.')
      : 'Este documento fue generado a partir de una plantilla y debe ser revisado por un profesional del derecho antes de presentarse.',
    numbered: false,
  });

  return doc;
};

export const renderToText = (
  template: ProfessionalTemplate,
  values: Record<string, string | string[]>
): string => {
  const doc = renderToDocument(template, values);
  let text = '';

  text += doc.header + '\n';
  text += doc.body + '\n';

  doc.sections.forEach(sec => {
    text += `\n${sec.title}\n`;
    if (Array.isArray(sec.content)) {
      sec.content.forEach((item, i) => {
        if (sec.numbered) {
          text += `${numberToOrdinal(i + 1)}.— ${item}\n`;
        } else {
          text += `- ${item}\n`;
        }
      });
    } else {
      text += `${sec.content}\n`;
    }
  });

  text += doc.footer + '\n';
  text += `\nGenerado el: ${new Date(doc.generatedAt).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
  })}\n`;
  text += `\n---\n${doc.disclaimer}`;

  return text;
};
