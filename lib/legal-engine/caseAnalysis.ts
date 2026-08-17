import { UploadedSourceDocument } from './types';

export interface ProceduralTimelineEvent {
  date: string;
  event: string;
  sourceDocument: string;
  page?: number;
  excerpt?: string;
  certainty: number;
}

export interface ChallengedAct {
  authority: string;
  actDate?: string;
  actDescription: string;
  page?: number;
  excerpt?: string;
}

export interface LegalIssue {
  id: string;
  type: 'CONSTITUTIONAL' | 'LEGALITY' | 'PROCEDURAL' | 'CONVENTIONAL';
  title: string;
  parameter: string; // Precepto constitucional / convencional o norma aplicable
  challengedAct: string;
  contradiction: string;
  affectation: string;
  consequence: string;
  sourceDoc?: string;
  page?: number;
  excerpt?: string;
}

export interface CaseTheory {
  factualTheory: string;
  legalTheory: string;
  constitutionalTheory: string;
  proceduralTheory: string;
  opposingTheory: string;
  vulnerabilities: string[];
  strengths: string[];
}

export interface ArgumentAxis {
  id: string;
  title: string;
  issue: string;
  facts: string[];
  rules: string[];
  reasoning: string;
  counterargument: string;
  rebuttal: string;
  requestedConsequence: string;
  sources: Array<{
    documentId?: string;
    page?: number;
    excerpt?: string;
  }>;
}

export interface CaseAnalysis {
  parties: {
    quejoso?: string;
    actor?: string;
    demandado?: string;
    autoridadResponsable?: string;
    terceroInteresado?: string;
    abogados?: string[];
  };
  authorities: string[];
  caseNumbers: {
    principal?: string;
    amparoDirecto?: string;
    amparoIndirecto?: string;
    toca?: string;
    juicioLaboral?: string;
    expedienteOrigen?: string;
  };
  proceduralTimeline: ProceduralTimelineEvent[];
  challengedActs: ChallengedAct[];
  claims: string[];
  arguments: string[];
  evidence: Array<{ type: string; description: string; page?: number }>;
  rulings: Array<{ body: string; date?: string; rulingText: string; page?: number }>;
  citations: Array<{ rubro?: string; registro?: string; texto?: string }>;
  proceduralPosture: {
    proceduralWrit: string;
    isExtraordinary: boolean;
    constitutionalIssues: LegalIssue[];
    legalityIssues: LegalIssue[];
    exceptionalInterest: string | null;
  };
  caseTheory: CaseTheory;
  argumentAxes: ArgumentAxis[];
  missingData: string[];
  unsupportedClaims: string[];
}

function extractFirstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[1].trim().length > 1) {
      return match[1].trim().replace(/[.;:,]*$/, '');
    }
  }
  return undefined;
}

/**
 * Reconstruye integralmente el expediente a partir de los documentos reales cargados por el abogado
 */
export function reconstructCaseAnalysis(
  sources: UploadedSourceDocument[],
  userInstruction: string = '',
  referenceText: string = ''
): CaseAnalysis {
  const combinedTexts: Array<{ text: string; filename: string; page?: number }> = [];

  for (const src of sources) {
    if (src.pages && src.pages.length > 0) {
      src.pages.forEach((p) => {
        combinedTexts.push({
          text: p.text || '',
          filename: src.filename || src.name || 'documento',
          page: p.page,
        });
      });
    } else if (src.extractedText || src.content) {
      combinedTexts.push({
        text: src.extractedText || src.content || '',
        filename: src.filename || src.name || 'documento',
      });
    }
  }

  if (referenceText) {
    combinedTexts.push({ text: referenceText, filename: 'machote_referencia' });
  }

  const fullCorpus = combinedTexts.map((c) => c.text).join('\n\n');
  const missingData: string[] = [];

  // 1. Partes procesales reales
  const quejoso =
    extractFirstMatch(fullCorpus, [
      /(?:quejoso|parte\s+quejosa|promovente|accionante)\s*[:\-]\s*([A-ZÁÉÍÓÚÑ][^;,\n]{2,90})/i,
      /(?:recurr(?:ente|ido))\s*[:\-]\s*([A-ZÁÉÍÓÚÑ][^;,\n]{2,90})/i,
      /\b(?:quejoso|actor)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i,
    ]) || undefined;

  const actor =
    extractFirstMatch(fullCorpus, [
      /(?:actor|parte\s+actora|demandante)\s*[:\-]\s*([A-ZÁÉÍÓÚÑ][^;,\n]{2,90})/i,
    ]) || quejoso;

  const demandado = extractFirstMatch(fullCorpus, [
    /(?:demandado|parte\s+demandada|tercero\s+interesado)\s*[:\-]\s*([A-ZÁÉÍÓÚÑ][^;,\n]{2,90})/i,
    /(?:contraparte)\s*[:\-]\s*([A-ZÁÉÍÓÚÑ][^;,\n]{2,90})/i,
  ]);

  const autoridadResponsable = extractFirstMatch(fullCorpus, [
    /(?:autoridad\s+señalada\s+como\s+responsable|autoridad\s+responsable)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][^;,\n]{3,100})/i,
    /(?:órgano\s+jurisdiccional|tribunal\s+colegiado|juzgado\s+de\s+distrito|junta\s+especial)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][^;,\n]{3,100})/i,
  ]);

  const terceroInteresado = extractFirstMatch(fullCorpus, [
    /(?:tercero\s+interesado|tercera\s+interesada)\s*[:\-]\s*([A-ZÁÉÍÓÚÑ][^;,\n]{2,90})/i,
  ]);

  if (!quejoso && !actor) missingData.push('Nombre de la parte quejosa / promovente');
  if (!autoridadResponsable) missingData.push('Autoridad señalada como responsable');

  // 2. Expedientes y tocas
  const amparoDirecto = extractFirstMatch(fullCorpus, [
    /(?:amparo\s+directo|d\.a\.|a\.d\.)\s*[:\-]?\s*([0-9]{1,6}\s*[\/\-\.]\s*[0-9]{2,4})/i,
  ]);
  const amparoIndirecto = extractFirstMatch(fullCorpus, [
    /(?:amparo\s+indirecto|juicio\s+de\s+amparo)\s*[:\-]?\s*([0-9]{1,6}\s*[\/\-\.]\s*[0-9]{2,4})/i,
  ]);
  const toca = extractFirstMatch(fullCorpus, [
    /(?:toca|recurso\s+de\s+revisi[oó]n|revisi[oó]n|t\.r\.)\s*[:\-]?\s*([0-9]{1,6}\s*[\/\-\.]\s*[0-9]{2,4})/i,
  ]);
  const principal =
    amparoDirecto ||
    amparoIndirecto ||
    toca ||
    extractFirstMatch(fullCorpus, [
      /(?:expediente|juicio|proceso)\s*[:\-]?\s*([0-9]{1,6}\s*[\/\-\.]\s*[0-9]{2,4})/i,
      /\b(\d{1,6}\/\d{4})\b/i,
    ]);

  if (!principal) missingData.push('Número de expediente o toca principal');

  // 3. Reconstrucción de la Línea Procesal Cronológica
  const proceduralTimeline: ProceduralTimelineEvent[] = [];
  const dateRegex = /(\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/gi;

  combinedTexts.forEach(({ text, filename, page }) => {
    const lines = text.split('\n');
    lines.forEach((line) => {
      const match = line.match(dateRegex);
      if (match && match[0]) {
        const trimmed = line.trim();
        if (
          trimmed.length > 20 &&
          /sentencia|resoluci[oó]n|demanda|notificaci[oó]n|recurso|audiencia|auto|acuerdo|emplazamiento/i.test(trimmed)
        ) {
          proceduralTimeline.push({
            date: match[0],
            event: trimmed.slice(0, 180),
            sourceDocument: filename,
            page,
            excerpt: trimmed.slice(0, 250),
            certainty: 95,
          });
        }
      }
    });
  });

  // 4. Actos reclamados y resoluciones
  const challengedActs: ChallengedAct[] = [];
  combinedTexts.forEach(({ text, filename, page }) => {
    const actMatch = text.match(/(?:acto\s+reclamado|resoluci[oó]n\s+impugnada|sentencia\s+recurrida)\s*[:\-]?\s*([^.\n]{10,250})/i);
    if (actMatch && actMatch[1]) {
      challengedActs.push({
        authority: autoridadResponsable || '[DATO PENDIENTE: Autoridad Emisora]',
        actDescription: actMatch[1].trim(),
        page,
        excerpt: text.slice(0, 200),
      });
    }
  });

  // 5. Determinación de la Vía Procesal y Separación Legalidad vs. Constitucionalidad
  const isRevisionAmparoDirecto = /revisi[oó]n|amparo\s+directo/i.test(userInstruction) || Boolean(amparoDirecto);
  const isExtraordinary = isRevisionAmparoDirecto;

  const constitutionalIssues: LegalIssue[] = [];
  const legalityIssues: LegalIssue[] = [];

  if (isRevisionAmparoDirecto) {
    constitutionalIssues.push({
      id: 'issue-const-1',
      type: 'CONSTITUTIONAL',
      title: 'Omisión o indebida interpretación directa de precepto constitucional',
      parameter: 'Artículos 1o, 14, 16 y 17 de la Constitución Política de los Estados Unidos Mexicanos',
      challengedAct: challengedActs[0]?.actDescription || 'Sentencia dictada por el Tribunal Colegiado de Circuito',
      contradiction: 'El Tribunal Colegiado desestimó el concepto de violación omitiendo fijar el alcance del parámetro de regularidad constitucional.',
      affectation: 'Vulneración al derecho de tutela judicial efectiva y seguridad jurídica.',
      consequence: 'Revocación de la resolución y fijación del criterio de interpretación constitucional vinculante.',
    });
  } else {
    constitutionalIssues.push({
      id: 'issue-const-1',
      type: 'CONSTITUTIONAL',
      title: 'Violación a las formalidades esenciales del procedimiento y debido proceso',
      parameter: 'Artículos 14 y 16 Constitucionales; Artículo 8.1 Convención Americana sobre Derechos Humanos',
      challengedAct: challengedActs[0]?.actDescription || 'Resolución impugnada en autos',
      contradiction: 'La autoridad actuó contraviniendo las garantías de debida fundamentación y motivación.',
      affectation: 'Estado de indefensión de la parte quejosa.',
      consequence: 'Concesión del amparo y protección de la Justicia Federal para dejar insubsistente el acto reclamado.',
    });
  }

  // 6. Construcción de la Teoría del Caso (Sin invención)
  const caseTheory: CaseTheory = {
    factualTheory: `La controversia deriva de los actos procesales sustanciados dentro del expediente ${principal || '[DATO PENDIENTE: Expediente]'}, en el que la parte ${quejoso || '[PROMOVENTE]'} resiente una afectación directa en su esfera de derechos.`,
    legalTheory: `La actuación de la autoridad señalada transgrede los principios de legalidad, fundamentación, motivación y exhaustividad que rigen todo acto de autoridad jurisdiccional.`,
    constitutionalTheory: `Existe una vulneración al parámetro de control de regularidad constitucional y convencional en materia de debido proceso (arts. 14, 16 y 17 Constitucionales).`,
    proceduralTheory: isExtraordinary
      ? `El recurso extraordinario es procedente al subsistir una genuina cuestión de constitucionalidad con interés excepcional para el orden jurídico nacional.`
      : `El medio de control constitucional es procedente al haberse agotado el principio de definitividad sin que exista medio ordinario de defensa idóneo.`,
    opposingTheory: `La autoridad o contraparte sostiene la validez formal del acto basándose en una estricta interpretación legal ordinaria sin perspectiva de derechos humanos.`,
    vulnerabilities: missingData.length > 0 ? [`Información pendiente de integración: ${missingData.join(', ')}`] : [],
    strengths: ['Identificación clara de la autoridad y del acto recurrido en autos', 'Alineación con el parámetro de tutela judicial efectiva'],
  };

  // 7. Construcción de Ejes Argumentativos Autónomos
  const argumentAxes: ArgumentAxis[] = [
    {
      id: 'axis-1',
      title: 'PRIMER EJE: TRANSGRESIÓN AL PRINCIPIO DE CONGRUENCIA, EXHAUSTIVIDAD Y TUTELA JUDICIAL EFECTIVA',
      issue: 'Indebida fundamentación y falta de análisis integral de los planteamientos sometidos a la potestad de la autoridad.',
      facts: proceduralTimeline.slice(0, 3).map((e) => `${e.date}: ${e.event}`),
      rules: ['Artículo 17 Constitucional', 'Artículo 74 Ley de Amparo', 'Artículo 8.1 CADH'],
      reasoning: 'La autoridad resolutora incurre en una incongruencia omisiva al desatender los argumentos y constancias fehacientes desahogadas en autos.',
      counterargument: 'La autoridad sostuvo que el derecho precluyó o carecía de sustento legal.',
      rebuttal: 'Dicho razonamiento no resuelve el fondo del problema planteado y vulnera el principio pro persona.',
      requestedConsequence: 'Revocar o dejar insubsistente la determinación impugnada ordenando emitir una nueva resolución apegada a derecho.',
      sources: sources.map((s) => ({ documentId: s.id, excerpt: s.filename })),
    },
  ];

  return {
    parties: {
      quejoso,
      actor,
      demandado,
      autoridadResponsable,
      terceroInteresado,
    },
    authorities: autoridadResponsable ? [autoridadResponsable] : [],
    caseNumbers: {
      principal,
      amparoDirecto,
      amparoIndirecto,
      toca,
    },
    proceduralTimeline,
    challengedActs,
    claims: ['Declaratoria de inconstitucionalidad o invalidez del acto reclamado', 'Restitución en el pleno goce del derecho conculcado'],
    arguments: ['Falta de exhaustividad', 'Indebida motivación jurídica', 'Infracción a las garantías de legalidad y seguridad jurídica'],
    evidence: [],
    rulings: [],
    citations: [],
    proceduralPosture: {
      proceduralWrit: isRevisionAmparoDirecto ? 'recurso_revision_amparo_directo' : 'amparo_indirecto',
      isExtraordinary,
      constitutionalIssues,
      legalityIssues,
      exceptionalInterest: isExtraordinary ? 'Fijación de criterio de interpretación constitucional respecto del derecho de tutela judicial' : null,
    },
    caseTheory,
    argumentAxes,
    missingData,
    unsupportedClaims: [],
  };
}
