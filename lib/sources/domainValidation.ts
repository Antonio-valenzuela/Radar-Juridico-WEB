import { SourceName } from "@/lib/sources/types";

export const ALLOWED_DOMAINS: Record<string, string[]> = {
  SIDOF: ["sidof.segob.gob.mx", "dof.gob.mx", "www.dof.gob.mx"],
  DOF_WEB: ["dof.gob.mx", "www.dof.gob.mx"],
  DIPUTADOS: ["diputados.gob.mx", "www.diputados.gob.mx"],
  SCJN_SJF: ["sjf2.scjn.gob.mx", "sjf.scjn.gob.mx"],
  SCJN_LEG: ["legislacion.scjn.gob.mx", "scjn.gob.mx"],
  PERIODICO_OFICIAL_JALISCO: ["periodicooficial.jalisco.gob.mx", "apiperiodico.jalisco.gob.mx"],
  SENADO_GACETA: ["senado.gob.mx", "www.senado.gob.mx"],
  SENADO_WEB: ["senado.gob.mx", "www.senado.gob.mx"],
};

export function validateDomainForSource(source: string, initialUrl: string, finalUrl: string): { ok: boolean; reason?: string; realDomain?: string } {
  // 1. Desactiva de inmediato SENADO_WEB para nuevas ingestas mientras se soluciona la discrepancia de dominio.
  if (source.toUpperCase() === "SENADO_WEB") {
    return { ok: false, reason: "SENADO_WEB ingestion is temporarily disabled due to domain discrepancies." };
  }

  const allowed = ALLOWED_DOMAINS[source.toUpperCase()];
  if (!allowed) {
    // Si la fuente no tiene allowlist estricta configurada, la dejamos pasar por ahora.
    return { ok: true };
  }

  try {
    const initialParsed = new URL(initialUrl);
    const finalParsed = new URL(finalUrl);

    const initialHost = initialParsed.hostname.toLowerCase();
    const finalHost = finalParsed.hostname.toLowerCase();

    if (!allowed.includes(initialHost)) {
      return { ok: false, reason: `Initial URL domain (${initialHost}) is not in allowlist for source ${source}`, realDomain: initialHost };
    }

    if (!allowed.includes(finalHost)) {
      return { ok: false, reason: `Final URL domain (${finalHost}) is not in allowlist for source ${source}`, realDomain: finalHost };
    }

    return { ok: true, realDomain: finalHost };
  } catch (error) {
    return { ok: false, reason: "Invalid URL provided for validation." };
  }
}
