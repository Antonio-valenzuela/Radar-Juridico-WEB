import type { AlertMatchInput, AlertMatchResult } from "./tasks";
import { isLegalMatter, type LegalMatter } from "./types";

const MATTER_LABELS: Record<LegalMatter, string[]> = {
  fiscal: ["fiscal", "sat", "shcp", "iva", "isr", "contribuyente"],
  laboral: ["laboral", "imss", "infonavit", "stps", "trabajo", "nomina"],
  salud: ["salud", "cofepris", "sanitario", "medicamento"],
  ambiental: ["ambiental", "semarnat", "profepa", "residuos"],
  energia: ["energia", "sener", "cre", "hidrocarburo", "electricidad"],
  financiero: ["financiero", "cnbv", "banxico", "bancario", "seguros"],
  administrativo: ["administrativo", "tramite", "dependencia"],
  comercio_exterior: ["comercio exterior", "aduana", "importacion", "exportacion"],
  proteccion_datos: ["datos personales", "privacidad", "inai"],
  otro: [],
};

export function matchAlertRule(input: AlertMatchInput): AlertMatchResult {
  const ruleText = normalize(input.ruleText);
  const documentText = normalize([input.documentTitle, input.documentSummary, input.aiAnalysis?.summary].join(" "));
  const reasons: string[] = [];
  const matchedKeywords = new Set<string>();
  let score = 0;

  const matter = normalizeMatter(input.matter || input.aiAnalysis?.matter);
  if (matter && matter !== "otro") {
    const matterTerms = MATTER_LABELS[matter] || [matter];
    const ruleMentionsMatter = matterTerms.some((term) => ruleText.includes(normalize(term)));
    const docMentionsMatter = matterTerms.some((term) => documentText.includes(normalize(term)));

    if (ruleMentionsMatter && docMentionsMatter) {
      score += 0.42;
      reasons.push(`Coincidencia fuerte por materia ${matter}.`);
      matchedKeywords.add(matter);
    }
  }

  const entities = uniqueNormalized([...(input.entities || []), ...(input.aiAnalysis?.entities || [])]);
  const entityMatches = entities.filter((entity) => entity && ruleText.includes(entity));
  if (entityMatches.length) {
    score += Math.min(0.25, entityMatches.length * 0.12);
    reasons.push("Coincidencia media por entidad regulatoria.");
    entityMatches.forEach((item) => matchedKeywords.add(item));
  }

  const sectors = uniqueNormalized([...(input.affectedSectors || []), ...(input.aiAnalysis?.affectedSectors || [])]);
  const sectorMatches = sectors.filter((sector) => sector && (ruleText.includes(sector) || documentText.includes(sector)));
  if (sectorMatches.length) {
    score += Math.min(0.2, sectorMatches.length * 0.1);
    reasons.push("Coincidencia media por sector afectado.");
    sectorMatches.forEach((item) => matchedKeywords.add(item));
  }

  const keywordMatches = findKeywordMatches(input, ruleText, documentText);
  if (keywordMatches.length) {
    score += Math.min(0.28, keywordMatches.length * 0.07);
    reasons.push("Coincidencia por terminos clave de la regla.");
    keywordMatches.forEach((item) => matchedKeywords.add(item));
  }

  const normalizedScore = Math.min(1, Number(score.toFixed(2)));
  return {
    matched: normalizedScore >= 0.35,
    score: normalizedScore,
    reasons,
    matchedKeywords: Array.from(matchedKeywords).slice(0, 12),
  };
}

function findKeywordMatches(input: AlertMatchInput, ruleText: string, documentText: string) {
  const configured = uniqueNormalized([...(input.keywords || []), ...(input.aiAnalysis?.keywords || [])]);
  const ruleTokens = tokenize(ruleText);
  const documentTokens = tokenize(documentText);
  const matches = new Set<string>();

  for (const keyword of configured) {
    if (keyword && (ruleText.includes(keyword) || documentText.includes(keyword))) {
      matches.add(keyword);
    }
  }

  for (const token of ruleTokens) {
    if (documentTokens.has(token) || documentText.includes(token)) {
      matches.add(token);
    }
  }

  return Array.from(matches);
}

function normalizeMatter(value: unknown): LegalMatter | null {
  return isLegalMatter(value) ? value : null;
}

function uniqueNormalized(values: string[]) {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function tokenize(value: string) {
  const stop = new Set(["sobre", "para", "con", "los", "las", "una", "uno", "del", "que", "por", "avisa", "avisame"]);
  return new Set(
    value
      .split(/[^a-z0-9]+/i)
      .map((token) => stem(token.trim()))
      .filter((token) => token.length >= 4 && !stop.has(token))
  );
}

function stem(value: string) {
  return value.replace(/(ciones|cion|es|s)$/i, "");
}

function normalize(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
