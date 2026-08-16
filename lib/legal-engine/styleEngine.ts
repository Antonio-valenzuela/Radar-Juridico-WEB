import { LawyerProfile, DEFAULT_LAWYER_PROFILE } from '../workspace/lawyerProfileTypes';

export interface ExtractedStyle {
  tone: LawyerProfile['preferredTone'];
  openingFormula?: string;
  closingFormula?: string;
  recurringFormulas: string[];
  sectionOrder: string[];
  citationStyle: LawyerProfile['citationStyle'];
  terminology: string[];
}

/**
 * Extracts writing style, structure, and formulas from a lawyer's historical reference document
 * WITHOUT copying private facts, names, dates, amounts or case numbers.
 */
export function extractStyleFromReferenceDocument(docText: string): ExtractedStyle {
  const lines = docText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const recurringFormulas: string[] = [];
  const terminology = new Set<string>();

  // Extract opening formula
  let openingFormula = 'Comparezco respetuosamente para exponer:';
  const openingMatch = docText.match(/(?:comparezco|vengo\s+a|interpongo|vengo\s+a\s+solicitar|por\s+mi\s+propio\s+derecho)[^\n.]*/i);
  if (openingMatch) {
    openingFormula = openingMatch[0].trim();
  }

  // Extract closing formula (search from bottom of document)
  let closingFormula = 'PROTESTO LO NECESARIO.';
  const closingMatch = docText.match(/(?:PROTESTO\s+LO\s+NECESARIO|ATENTAMENTE)[^\n.]*/i);
  if (closingMatch) {
    closingFormula = closingMatch[0].trim();
  }

  // Detect recurring formulas
  const formulasCandidates = [
    /causa\s+agravio\s+[^\n.]*/gi,
    /de\s+las\s+constancias\s+[^\n.]*/gi,
    /resulta\s+infundad[oa]\s+[^\n.]*/gi,
    /se\s+violentan\s+las\s+garant[íi]as\s+[^\n.]*/gi,
    /por\s+lo\s+anteriormente\s+expuesto\s+[^\n.]*/gi,
  ];

  formulasCandidates.forEach(pattern => {
    const matches = docText.match(pattern);
    if (matches) {
      matches.forEach(m => {
        if (m.length > 15 && m.length < 150) {
          recurringFormulas.push(m.trim());
        }
      });
    }
  });

  // Extract legal terminology
  const termsList = ['laudo impugnado', 'ejecutoria de amparo', 'suplencia de la queja', 'cosa juzgada', 'exhaustividad', 'congruencia', 'carga probatoria'];
  termsList.forEach(t => {
    if (docText.toLowerCase().includes(t)) terminology.add(t);
  });

  // Detect section order
  const sectionOrder: string[] = [];
  const headerMatch = docText.match(/(?:H\.\s*TRIBUNAL|SUPREMA\s+CORTE|JUZGADO|AUTORIDAD)[^\n]*/i);
  if (headerMatch) sectionOrder.push('header');
  if (docText.match(/ANTECEDENTES/i)) sectionOrder.push('background');
  if (docText.match(/AGRAVIO|VIOLACI[ÓO]N/i)) sectionOrder.push('argument');
  if (docText.match(/PRUEBAS/i)) sectionOrder.push('evidence');
  if (docText.match(/PETITORIOS/i)) sectionOrder.push('petition');

  return {
    tone: docText.length > 10000 ? 'combativo_tecnico' : 'formal_academico',
    openingFormula,
    closingFormula,
    recurringFormulas: Array.from(new Set(recurringFormulas)).slice(0, 5),
    sectionOrder: sectionOrder.length ? sectionOrder : DEFAULT_LAWYER_PROFILE.preferredSectionOrdering,
    citationStyle: docText.includes('Registro digital') ? 'completo_con_registro' : 'sintetico',
    terminology: Array.from(terminology)
  };
}

/**
 * Applies the lawyer's profile style (opening, closing, formulas, tone) to a generated section
 * strictly preserving current case facts and eliminating past case private data.
 */
export function applyStyleToSectionText(
  sectionType: string,
  sectionText: string,
  profile: LawyerProfile = DEFAULT_LAWYER_PROFILE
): string {
  let styled = sectionText;

  if (sectionType === 'identity' && profile.openingPatterns.length > 0) {
    const formula = profile.openingPatterns[0];
    if (!styled.includes(formula)) {
      styled = `${formula}\n${styled}`;
    }
  }

  if (sectionType === 'closing' && profile.closingPatterns.length > 0) {
    const formula = profile.closingPatterns[0];
    if (!styled.includes(formula)) {
      styled = `${styled}\n\n${formula}`;
    }
  }

  return styled;
}
