import { LEGAL_THESAURUS } from "./legalThesaurus";
import { normalizeLegalText } from "./normalizeLegalText";

export interface ExpandedLegalQuery {
  originalQuery: string;
  normalizedQuery: string;
  canonicalTopic?: string;
  expandedTerms: string[];
  relatedMaterias: string[];
  suggestedSources: string[];
  confidence: number;
}

export function expandLegalQuery(query: string): ExpandedLegalQuery {
  const normQuery = normalizeLegalText(query || "");
  const expandedTermsSet = new Set<string>();
  const relatedMateriasSet = new Set<string>();
  let canonicalTopic: string | undefined = undefined;
  let confidence = 0.0;

  // Try to find matching entries in the thesaurus
  for (const [key, entry] of Object.entries(LEGAL_THESAURUS)) {
    const keyNorm = normalizeLegalText(key);
    const canonicalNorm = normalizeLegalText(entry.canonical);
    
    // Check if key or canonical is in normalized query
    const directMatch = normQuery.includes(keyNorm) || normQuery.includes(canonicalNorm);

    // Check if any alias is in normalized query or matches it
    let aliasMatch = false;
    for (const alias of entry.aliases) {
      const aliasNorm = normalizeLegalText(alias);
      if (normQuery.includes(aliasNorm) || aliasNorm.includes(normQuery)) {
        aliasMatch = true;
        break;
      }
    }

    if (directMatch || aliasMatch) {
      canonicalTopic = entry.canonical;
      confidence = directMatch ? 1.0 : 0.8;

      // Add aliases & relatedTerms
      for (const alias of entry.aliases) {
        expandedTermsSet.add(alias);
      }
      for (const term of entry.relatedTerms) {
        expandedTermsSet.add(term);
      }
      // Add materias
      for (const mat of entry.materias) {
        relatedMateriasSet.add(mat);
      }
    }
  }

  const expandedTerms = Array.from(expandedTermsSet);
  const relatedMaterias = Array.from(relatedMateriasSet);

  if (expandedTerms.length === 0 && query) {
    expandedTerms.push(query);
  }

  // Derive suggested sources based on materias
  const suggestedSourcesSet = new Set<string>();
  if (relatedMaterias.includes("Penal")) suggestedSourcesSet.add("SCJN");
  if (relatedMaterias.includes("Fiscal")) suggestedSourcesSet.add("SAT");
  if (relatedMaterias.includes("Constitucional")) suggestedSourcesSet.add("SCJN");
  suggestedSourcesSet.add("DOF");

  return {
    originalQuery: query,
    normalizedQuery: normQuery,
    canonicalTopic,
    expandedTerms,
    relatedMaterias,
    suggestedSources: Array.from(suggestedSourcesSet),
    confidence
  };
}
