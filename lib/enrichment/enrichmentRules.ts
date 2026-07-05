import { LegalMatter, LEGAL_MATTERS } from "../ai/types";

/**
 * Validates whether a matter is a supported matter.
 */
export function isValidMatter(matter: string): matter is LegalMatter {
  return LEGAL_MATTERS.includes(matter as LegalMatter);
}

/**
 * Rules for authorities:
 * - If it matches known authorities, return its normalized form.
 * - If not clear, return null.
 * - Never invent.
 */
export function normalizeAuthority(authority: string | null): string | null {
  if (!authority) return null;
  const clean = authority.trim().toUpperCase();
  if (["SAT", "SERVICIO DE ADMINISTRACION TRIBUTARIA"].includes(clean)) return "SAT";
  if (["SCJN", "SUPREMA CORTE DE JUSTICIA DE LA NACION", "SUPREMA CORTE"].includes(clean)) return "SCJN";
  if (["SHCP", "SECRETARIA DE HACIENDA Y CREDITO PUBLICO", "SECRETARÍA DE HACIENDA"].includes(clean)) return "SHCP";
  if (["IMSS", "INSTITUTO MEXICANO DEL SEGURO SOCIAL"].includes(clean)) return "IMSS";
  if (["COFEPRIS"].includes(clean)) return "COFEPRIS";
  if (["STPS", "SECRETARIA DEL TRABAJO"].includes(clean)) return "STPS";
  if (["SENER", "SECRETARIA DE ENERGIA"].includes(clean)) return "SENER";
  if (["SEMARNAT"].includes(clean)) return "SEMARNAT";
  if (["INAI"].includes(clean)) return "INAI";
  if (["CNBV"].includes(clean)) return "CNBV";

  // Return the original casing if not in standard list, or null if empty
  return authority.trim() || null;
}
