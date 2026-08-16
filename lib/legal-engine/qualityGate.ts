import { UniversalLegalDocument, ValidationIssue } from './types';

export interface QualityGateResult {
  passed: boolean;
  canMarkAsFinal: boolean;
  qualityScore: number; // 0 to 100
  criticalErrors: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: string[];
  metrics: {
    totalSections: number;
    emptySectionsCount: number;
    wordCount: number;
    characterCount: number;
    pendingFieldsCount: number;
    unverifiedCitationsCount: number;
    manuallyEditedSectionsCount: number;
    sourceReferencesCount: number;
  };
}

export function runQualityGateCheck(doc: UniversalLegalDocument): QualityGateResult {
  const criticalErrors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const suggestions: string[] = [];

  let wordCount = 0;
  let characterCount = 0;
  let emptySectionsCount = 0;
  let pendingFieldsCount = 0;
  let unverifiedCitationsCount = 0;
  let manuallyEditedSectionsCount = 0;
  let sourceReferencesCount = 0;

  const totalSections = doc.sections.length;

  doc.sections.forEach((sec) => {
    if (sec.isManuallyEdited) manuallyEditedSectionsCount++;

    const secText = sec.content.map((b) => {
      if (b.sources && b.sources.length > 0) sourceReferencesCount += b.sources.length;
      return b.text;
    }).join('\n\n').trim();

    if (!secText) {
      emptySectionsCount++;
      criticalErrors.push({
        checkId: `empty_section_${sec.id}`,
        sectionId: sec.id,
        message: `La sección "${sec.title}" está vacía sin contenido redactado.`
      });
    } else {
      characterCount += secText.length;
      wordCount += secText.split(/\s+/).filter(Boolean).length;

      // Check unflagged pending markers (e.g. raw [NOMBRE] without DATO PENDIENTE)
      const rawBracketMatches = secText.match(/\[(?!DATO PENDIENTE|NO VERIFICADO|DOCUMENTO GENERADO)[A-ZÁÉÍÓÚÑ_\s]{3,}\]/g);
      if (rawBracketMatches) {
        pendingFieldsCount += rawBracketMatches.length;
        warnings.push({
          checkId: `unflagged_pending_${sec.id}`,
          sectionId: sec.id,
          message: `La sección "${sec.title}" contiene marcadore(s) pendiente(s) no estandarizado(s): ${rawBracketMatches.join(', ')}`
        });
      }

      // Check DATO PENDIENTE count
      const pendingMatches = secText.match(/\[DATO PENDIENTE:[^\]]+\]/g);
      if (pendingMatches) {
        pendingFieldsCount += pendingMatches.length;
        warnings.push({
          checkId: `pending_data_${sec.id}`,
          sectionId: sec.id,
          message: `La sección "${sec.title}" contiene ${pendingMatches.length} campo(s) marcado(s) como DATO PENDIENTE.`
        });
      }

      // Check UNVERIFIED citations
      const unverifiedMatches = secText.match(/\[NO VERIFICADO:[^\]]+\]/g);
      if (unverifiedMatches) {
        unverifiedCitationsCount += unverifiedMatches.length;
        warnings.push({
          checkId: `unverified_citation_${sec.id}`,
          sectionId: sec.id,
          message: `La sección "${sec.title}" contiene ${unverifiedMatches.length} cita(s) o jurisprudencia(s) no verificada(s).`
        });
      }

      // Check repeated paragraphs inside section
      const paragraphs = secText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      const uniqueParagraphs = new Set(paragraphs);
      if (paragraphs.length > uniqueParagraphs.size) {
        warnings.push({
          checkId: `duplicate_paragraphs_${sec.id}`,
          sectionId: sec.id,
          message: `La sección "${sec.title}" contiene párrafos duplicados o repetidos.`
        });
      }
    }
  });

  // Check document length quality gate
  if (characterCount < 300) {
    criticalErrors.push({
      checkId: 'doc_too_short',
      message: `El escrito es demasiado corto (${characterCount} caracteres, ${wordCount} palabras). No cumple con el estándar de extensión jurídica exhaustiva.`
    });
  }

  // Check petition section requirement
  const hasPetition = doc.sections.some(s => s.type === 'petition' && s.content.some(b => b.text.trim()));
  if (!hasPetition) {
    criticalErrors.push({
      checkId: 'missing_petition',
      message: 'El escrito no contiene la sección obligatoria de Puntos Petitorios.'
    });
  }

  // Calculate Quality Score
  let qualityScore = 100;
  qualityScore -= criticalErrors.length * 25;
  qualityScore -= emptySectionsCount * 15;
  qualityScore -= pendingFieldsCount * 5;
  qualityScore -= unverifiedCitationsCount * 5;
  if (characterCount < 1000) qualityScore -= 10;
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  const passed = criticalErrors.length === 0;
  const canMarkAsFinal = passed && pendingFieldsCount === 0 && emptySectionsCount === 0;

  if (!canMarkAsFinal) {
    suggestions.push('Resuelva los campos [DATO PENDIENTE] antes de marcar el documento como FINALIZADO.');
  }
  if (unverifiedCitationsCount > 0) {
    suggestions.push('Coteje las citas con la Gaceta del Semanario Judicial de la Federación.');
  }

  return {
    passed,
    canMarkAsFinal,
    qualityScore,
    criticalErrors,
    warnings,
    suggestions,
    metrics: {
      totalSections,
      emptySectionsCount,
      wordCount,
      characterCount,
      pendingFieldsCount,
      unverifiedCitationsCount,
      manuallyEditedSectionsCount,
      sourceReferencesCount,
    }
  };
}
