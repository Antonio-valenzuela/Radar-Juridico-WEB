import { ClassificationResult, RequiredInput } from './types';

interface DocTypeRule {
  pattern: RegExp[];
  documentType: string;
  documentTypeLabel: string;
  matter: string;
  jurisdiction: string;
  proceduralStage: string;
  authority?: string;
  objective: string;
  requiredInputs: RequiredInput[];
}

export const DOC_TYPE_RULES: DocTypeRule[] = [
  {
    pattern: [/recurso.*revisi[oó]n.*amparo.*directo/i, /revisi[oó]n.*en.*amparo.*directo/i],
    documentType: 'recurso_revision_amparo_directo',
    documentTypeLabel: 'Recurso de Revisión en Amparo Directo',
    matter: 'constitucional',
    jurisdiction: 'federal',
    proceduralStage: 'recurso',
    authority: 'Suprema Corte de Justicia de la Nación',
    objective: 'Impugnar sentencia de amparo directo por cuestiones de constitucionalidad',
    requiredInputs: []
  },
  {
    pattern: [/recurso.*queja/i, /queja/i],
    documentType: 'recurso_queja',
    documentTypeLabel: 'Recurso de Queja',
    matter: 'general',
    jurisdiction: 'federal',
    proceduralStage: 'recurso',
    objective: 'Impugnar resoluciones que no admiten revisión',
    requiredInputs: []
  },
  {
    pattern: [/recurso.*reclamaci[oó]n/i, /reclamaci[oó]n/i],
    documentType: 'recurso_reclamacion',
    documentTypeLabel: 'Recurso de Reclamación',
    matter: 'general',
    jurisdiction: 'federal',
    proceduralStage: 'recurso',
    objective: 'Impugnar acuerdos de trámite',
    requiredInputs: []
  },
  {
    pattern: [/demanda.*amparo.*indirecto/i, /amparo.*indirecto/i],
    documentType: 'demanda_amparo_indirecto',
    documentTypeLabel: 'Demanda de Amparo Indirecto',
    matter: 'constitucional',
    jurisdiction: 'federal',
    proceduralStage: 'inicial',
    objective: 'Solicitar protección de la justicia federal contra actos de autoridad',
    requiredInputs: []
  },
  {
    pattern: [/demanda.*amparo.*directo/i, /amparo.*directo/i],
    documentType: 'demanda_amparo_directo',
    documentTypeLabel: 'Demanda de Amparo Directo',
    matter: 'constitucional',
    jurisdiction: 'federal',
    proceduralStage: 'inicial',
    objective: 'Impugnar sentencias definitivas',
    requiredInputs: []
  },
  {
    pattern: [/(?:contestaci[oó]n|contestar).*(?:demanda)?.*laboral/i, /laboral.*(?:contestaci[oó]n|contestar)/i],
    documentType: 'contestacion_demanda_laboral',
    documentTypeLabel: 'Contestación de Demanda Laboral',
    matter: 'laboral',
    jurisdiction: 'local',
    proceduralStage: 'instruccion',
    objective: 'Dar contestación a demanda laboral',
    requiredInputs: []
  },
  {
    pattern: [/(?:contestaci[oó]n|contestar).*(?:demanda)?.*civil/i, /civil.*(?:contestaci[oó]n|contestar)/i],
    documentType: 'contestacion_demanda_civil',
    documentTypeLabel: 'Contestación de Demanda Civil',
    matter: 'civil',
    jurisdiction: 'local',
    proceduralStage: 'instruccion',
    objective: 'Dar contestación a demanda civil',
    requiredInputs: []
  },
  {
    pattern: [/contestaci[oó]n/i, /contestar/i],
    documentType: 'contestacion_demanda',
    documentTypeLabel: 'Contestación de Demanda',
    matter: 'general',
    jurisdiction: 'general',
    proceduralStage: 'instruccion',
    objective: 'Dar contestación a una demanda',
    requiredInputs: []
  },
  {
    pattern: [/escrito.*agravios/i, /agravios/i],
    documentType: 'escrito_agravios',
    documentTypeLabel: 'Escrito de Agravios',
    matter: 'general',
    jurisdiction: 'general',
    proceduralStage: 'recurso',
    objective: 'Expresar agravios en recurso de apelación',
    requiredInputs: []
  },
  {
    pattern: [/recurso.*resoluci[oó]n/i, /impugnar.*resoluci[oó]n/i, /recurso\s+administrativo/i],
    documentType: 'recurso_administrativo',
    documentTypeLabel: 'Recurso Administrativo',
    matter: 'administrativo',
    jurisdiction: 'administrativo',
    proceduralStage: 'impugnacion',
    objective: 'Impugnar resolución ante autoridad administrativa',
    requiredInputs: []
  },
  {
    pattern: [/cumplimiento.*sentencia/i],
    documentType: 'escrito_cumplimiento_sentencia',
    documentTypeLabel: 'Escrito sobre Cumplimiento de Sentencia',
    matter: 'general',
    jurisdiction: 'general',
    proceduralStage: 'ejecucion',
    objective: 'Manifestar cumplimiento o incumplimiento de sentencia',
    requiredInputs: []
  },
  {
    pattern: [/incidente/i],
    documentType: 'incidente_procesal',
    documentTypeLabel: 'Incidente Procesal',
    matter: 'general',
    jurisdiction: 'general',
    proceduralStage: 'incidental',
    objective: 'Resolver cuestión accesoria al juicio',
    requiredInputs: []
  },
  {
    pattern: [/r[eé]plica/i],
    documentType: 'replica',
    documentTypeLabel: 'Escrito de Réplica',
    matter: 'general',
    jurisdiction: 'general',
    proceduralStage: 'instruccion',
    objective: 'Contestar excepciones y defensas',
    requiredInputs: []
  },
  {
    pattern: [/d[uú]plica/i],
    documentType: 'duplica',
    documentTypeLabel: 'Escrito de Dúplica',
    matter: 'general',
    jurisdiction: 'general',
    proceduralStage: 'instruccion',
    objective: 'Contestar a la réplica',
    requiredInputs: []
  },
  {
    pattern: [/demanda/i],
    documentType: 'demanda',
    documentTypeLabel: 'Demanda Inicial',
    matter: 'general',
    jurisdiction: 'general',
    proceduralStage: 'inicial',
    objective: 'Iniciar procedimiento judicial',
    requiredInputs: []
  },
  {
    pattern: [/escrito.*libre/i, /promoci[oó]n/i],
    documentType: 'escrito_libre',
    documentTypeLabel: 'Escrito Libre',
    matter: 'general',
    jurisdiction: 'general',
    proceduralStage: 'cualquiera',
    objective: 'Realizar peticiones diversas',
    requiredInputs: []
  }
];

const FALLBACK_CLASSIFICATION: ClassificationResult = {
  documentType: 'escrito_libre',
  documentTypeLabel: 'Escrito Libre / Promoción',
  matter: 'general',
  jurisdiction: 'general',
  proceduralStage: 'cualquiera',
  objective: 'Solicitud libre al órgano jurisdiccional',
  requiredInputs: [],
  confidence: 0,
  isDynamic: true
};

export function classifyIntent(userText: string): ClassificationResult {
  const text = userText.toLowerCase();
  
  for (const rule of DOC_TYPE_RULES) {
    for (const pattern of rule.pattern) {
      if (pattern.test(text)) {
        return {
          documentType: rule.documentType,
          documentTypeLabel: rule.documentTypeLabel,
          matter: rule.matter,
          jurisdiction: rule.jurisdiction,
          proceduralStage: rule.proceduralStage,
          authority: rule.authority,
          objective: rule.objective,
          requiredInputs: rule.requiredInputs,
          confidence: 0.8,
          isDynamic: false
        };
      }
    }
  }
  
  return { ...FALLBACK_CLASSIFICATION };
}

export function mergeWithAiClassification(base: ClassificationResult, aiClass: Partial<ClassificationResult>): ClassificationResult {
  return { ...base, ...aiClass, confidence: (base.confidence || 0) + 0.1 };
}
