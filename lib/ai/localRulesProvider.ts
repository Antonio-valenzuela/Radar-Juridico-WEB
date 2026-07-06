import type { LegalAiAnalysis, LegalAiInput, LegalMatter } from "./types";
import { sanitizeLegalAiAnalysis } from "./types";

type RuleSignal = {
  matter: LegalMatter;
  pattern: RegExp;
  entities: string[];
  sectors: string[];
  keywords: string[];
};

const SIGNALS: RuleSignal[] = [
  {
    matter: "fiscal",
    pattern: /\b(SAT|SHCP|ISR|IVA|IEPS|RFC|FISCAL|CONTRIBUYENTE|MISCELANEA FISCAL|MISCELÁNEA FISCAL)\b/i,
    entities: ["SAT", "SHCP"],
    sectors: ["contribuyentes", "empresas", "contadores", "área fiscal"],
    keywords: ["SAT", "ISR", "IVA", "fiscal"],
  },
  {
    matter: "laboral",
    pattern: /\b(IMSS|INFONAVIT|STPS|TRABAJO|LABORAL|SALARIO|SEGURIDAD SOCIAL|CUOTAS OBRERO PATRONALES)\b/i,
    entities: ["IMSS", "INFONAVIT", "STPS"],
    sectors: ["empleadores", "trabajadores", "recursos humanos", "nómina"],
    keywords: ["IMSS", "INFONAVIT", "STPS", "laboral"],
  },
  {
    matter: "salud",
    pattern: /\b(COFEPRIS|SALUD|SANITARIO|MEDICAMENTO|INSUMOS PARA LA SALUD|SECRETARIA DE SALUD|SECRETARÍA DE SALUD)\b/i,
    entities: ["COFEPRIS", "Secretaría de Salud"],
    sectors: ["salud", "farmacéutico", "hospitales", "dispositivos médicos"],
    keywords: ["COFEPRIS", "salud", "sanitario"],
  },
  {
    matter: "energia",
    pattern: /\b(CRE|SENER|ENERGIA|ENERGÍA|HIDROCARBURO|ELECTRICIDAD|CENACE|PETROLIFERO|PETROLÍFERO)\b/i,
    entities: ["CRE", "SENER", "CENACE"],
    sectors: ["energía", "eléctrico", "hidrocarburos", "combustibles"],
    keywords: ["CRE", "SENER", "energía"],
  },
  {
    matter: "ambiental",
    pattern: /\b(SEMARNAT|PROFEPA|AMBIENTAL|MEDIO AMBIENTE|RESIDUOS|EMISIONES|IMPACTO AMBIENTAL)\b/i,
    entities: ["SEMARNAT", "PROFEPA"],
    sectors: ["ambiental", "industria regulada", "manufactura"],
    keywords: ["SEMARNAT", "ambiental", "residuos"],
  },
  {
    matter: "financiero",
    pattern: /\b(CNBV|BANXICO|BANCO DE MEXICO|BANCO DE MÉXICO|FINANCIERO|BANCARIO|VALORES|SEGUROS|AFORE|CONDUSEF)\b/i,
    entities: ["CNBV", "Banco de México", "CONDUSEF"],
    sectors: ["financiero", "banca", "seguros", "fintech"],
    keywords: ["CNBV", "financiero", "bancario"],
  },
  {
    matter: "proteccion_datos",
    pattern: /\b(INAI|DATOS PERSONALES|PRIVACIDAD|PROTECCION DE DATOS|PROTECCIÓN DE DATOS|AVISO DE PRIVACIDAD)\b/i,
    entities: ["INAI"],
    sectors: ["privacidad", "cumplimiento", "tecnología", "empresas con datos personales"],
    keywords: ["INAI", "datos personales", "privacidad"],
  },
  {
    matter: "aduanal",
    pattern: /\b(ADUANA|ADUANAL|ADUANERO|COMERCIO EXTERIOR|IMPORTACION|IMPORTACIÓN|EXPORTACION|EXPORTACIÓN|ARANCEL|FRACCION ARANCELARIA|FRACCIÓN ARANCELARIA|AGENTE ADUANAL|PEDIMENTO|DESPACHO ADUANERO|ANAM|SAT COMERCIO EXTERIOR|LEY ADUANERA)\b/i,
    entities: ["ANAM", "SAT"],
    sectors: ["importadores", "exportadores", "agentes aduanales", "comercio exterior"],
    keywords: ["ANAM", "aduana", "aduanal", "comercio exterior", "arancel", "pedimento"],
  },
];

function detectAuthority(text: string): string | null {
  if (/\b(ANAM|AGENCIA NACIONAL DE ADUANAS)\b/i.test(text)) return "ANAM";
  if (/\b(SAT|SERVICIO DE ADMINISTRACION TRIBUTARIA)\b/i.test(text)) return "SAT";
  if (/\b(SCJN|SUPREMA CORTE|MINISTRO|MINISTRA)\b/i.test(text)) return "SCJN";
  if (/\b(SHCP|SECRETARIA DE HACIENDA)\b/i.test(text)) return "SHCP";
  if (/\b(IMSS|INSTITUTO MEXICANO DEL SEGURO SOCIAL)\b/i.test(text)) return "IMSS";
  if (/\b(COFEPRIS|COMISION FEDERAL PARA LA PROTECCION CONTRA RIESGOS SANITARIOS)\b/i.test(text)) return "COFEPRIS";
  if (/\b(STPS|SECRETARIA DEL TRABAJO)\b/i.test(text)) return "STPS";
  if (/\b(SENER|SECRETARIA DE ENERGIA)\b/i.test(text)) return "SENER";
  if (/\b(SEMARNAT|SECRETARIA DE MEDIO AMBIENTE)\b/i.test(text)) return "SEMARNAT";
  if (/\b(INAI|INSTITUTO NACIONAL DE TRANSPARENCIA)\b/i.test(text)) return "INAI";
  if (/\b(CNBV|COMISION NACIONAL BANCARIA)\b/i.test(text)) return "CNBV";
  return null;
}

export async function analyzeWithLocalRules(input: LegalAiInput): Promise<LegalAiAnalysis> {
  const text = normalizeText([input.title, input.summary, input.text].filter(Boolean).join(" "));
  const matches = SIGNALS.filter((signal) => signal.pattern.test(text));
  const primary = matches[0];

  const matter = primary?.matter || "otro";
  const entities = Array.from(new Set(matches.flatMap((signal) => signal.entities))).slice(0, 20);
  const affectedSectors = Array.from(new Set(matches.flatMap((signal) => signal.sectors))).slice(0, 12);
  const keywords = Array.from(new Set(matches.flatMap((signal) => signal.keywords))).slice(0, 12);

  const impactLevel = detectImpactLevel(text, matter);
  const confidence = primary ? Math.min(0.9, 0.55 + matches.length * 0.1) : 0.35;
  const authority = detectAuthority(text);

  return sanitizeLegalAiAnalysis(
    {
      matter,
      confidence,
      summary: buildLocalSummary(input, matter, impactLevel),
      entities,
      affectedSectors: affectedSectors.length ? affectedSectors : ["sector público", "sujetos regulados"],
      impactLevel,
      keywords: keywords.length ? keywords : ["regulación", "publicación oficial"],
      authority,
      relatedTopics: [matter, "regulación", "diario oficial"],
      explanation: `Documento oficial clasificado localmente en materia ${matter} con nivel de impacto ${impactLevel}.`,
      sourceGrounding: input.sourceUrl
        ? [
            {
              title: input.title,
              url: input.sourceUrl,
            },
          ]
        : undefined,
    },
    input
  );
}

export const localRulesProvider = {
  analyzeLegalDocument: analyzeWithLocalRules,
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function detectImpactLevel(text: string, matter: LegalMatter): "low" | "medium" | "high" {
  if (
    /\b(DECRETO|REFORMA|REFORMAN|ADICIONA|ADICIONAN|DEROGA|DEROGAN|ABROGA|EXPIDE|OBLIGACIONES|SANCION|SANCIÓN|MULTA|TRANSITORIO)\b/i.test(
      text
    )
  ) {
    return "high";
  }

  if (matter !== "otro" && matter !== "administrativo") {
    return "medium";
  }

  return "low";
}

function buildLocalSummary(
  input: LegalAiInput,
  matter: LegalMatter,
  impactLevel: "low" | "medium" | "high"
) {
  const base = input.summary?.trim() || input.title.trim();
  const impact =
    impactLevel === "high"
      ? "alto impacto potencial"
      : impactLevel === "medium"
        ? "impacto medio potencial"
        : "bajo impacto inicial";

  return `${base.slice(0, 700)}. Clasificación local: materia ${matter}, ${impact}.`;
}
