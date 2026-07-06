import { generateLlmCompletion } from "../ai-provider";
import { prisma } from "@/lib/prisma";

// Legacy static fallback, still kept for safety
export const ALLOWED_OFFICIAL_DOMAINS = [
  "dof.gob.mx",
  "www.dof.gob.mx",
  "sidof.segob.gob.mx",
  "scjn.gob.mx",
  "sjf2.scjn.gob.mx",
  "legislacion.scjn.gob.mx",
  "cjf.gob.mx",
  "www.cjf.gob.mx",
  "sise.cjf.gob.mx",
  "www.dgej.cjf.gob.mx",
  "diputados.gob.mx",
  "www.diputados.gob.mx",
  "senado.gob.mx",
  "www.senado.gob.mx",
  "conamer.gob.mx",
  "periodicooficial.jalisco.gob.mx",
  "ciudadano.cjj.gob.mx"
];

const MATTER_FALLBACK: Record<string, { terms: string[]; authorities: string[] }> = {
  laboral: {
    terms: ['reforma laboral', 'outsourcing', 'subcontratación', 'STPS', 'IMSS'],
    authorities: ['STPS', 'IMSS', 'Juzgados del Trabajo'],
  },
  fiscal: {
    terms: ['reforma fiscal', 'ISR', 'IVA', 'CFDI', 'SAT'],
    authorities: ['SAT', 'Congreso', 'Cámara de Diputados'],
  },
  familiar: {
    terms: [
      'alimentos',
      'obligación de alimentos',
      'pensión alimenticia',
      'deudor alimentario',
      'guarda y custodia',
      'convivencia',
      'patria potestad',
      'divorcio',
      'sucesiones',
    ],
    authorities: [
      'Juzgados de Familia',
      'Tribunales Familiares',
      'SCJN',
      'Congreso Estatal',
    ],
  },
  civil: {
    terms: ['derecho civil', 'contratos', 'obligaciones', 'responsabilidad civil', 'sucesiones', 'procedimiento civil'],
    authorities: ['Juzgados Civiles', 'SCJN', 'Congreso', 'Cámara de Diputados'],
  },
  mercantil: {
    terms: ['contrato mercantil', 'sociedad', 'quiebra', 'embargo', 'insolvencia'],
    authorities: ['Juzgados Mercantiles', 'CONAMER'],
  },
  cnpcf: {
    terms: [
      'Código Nacional de Procedimientos Civiles y Familiares',
      'CNPCF',
      'procedimiento civil',
      'procedimiento familiar',
      'oralidad civil',
      'justicia digital'
    ],
    authorities: ['Cámara de Diputados', 'DOF', 'SCJN', 'Consejo de la Judicatura Federal'],
  },
  amparo: {
    terms: ['juicio de amparo', 'amparo indirecto', 'amparo directo', 'suspensión del acto reclamado', 'recurso de revisión'],
    authorities: ['SCJN', 'Tribunales Colegiados de Circuito', 'Juzgados de Distrito'],
  },
  judicial: {
    terms: ['boletín judicial', 'lista de acuerdos', 'SISE', 'expediente judicial', 'Consejo de la Judicatura Federal'],
    authorities: ['Consejo de la Judicatura Federal', 'Poder Judicial Federal', 'Consejos de la Judicatura estatales'],
  },
  penal: {
    terms: ['reforma penal', 'amparo', 'jurisprudencia', 'tesis aislada'],
    authorities: ['SCJN', 'Tribunales de Alzada', 'Ministerio Público'],
  },
  aduanal: {
    terms: ['aduana', 'aduanal', 'comercio exterior', 'importación', 'exportación', 'arancel', 'fracción arancelaria', 'agente aduanal', 'pedimento', 'despacho aduanero', 'ANAM', 'SAT comercio exterior', 'Ley Aduanera'],
    authorities: ['ANAM', 'SAT', 'SHCP', 'Cámara de Diputados'],
  },
  comercio_exterior: {
    terms: ['comercio exterior', 'importación', 'exportación', 'arancel', 'fracción arancelaria', 'T-MEC', 'SAT comercio exterior', 'ANAM'],
    authorities: ['ANAM', 'SAT', 'Secretaría de Economía', 'Congreso de la Unión'],
  },
};

export async function expandLegalSearch(params: {
  query: string;
  matter?: string;
  authority?: string;
  impactLevel?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const query = params.query;
  let matter = params.matter;

  // Inferir materia a partir de palabras clave si no está especificada (mejora fallback local)
  if (!matter && query) {
    const q = query.toLowerCase();
    if (q.includes("familiar") || q.includes("familia") || q.includes("alimentos") || q.includes("divorcio") || q.includes("custodia") || q.includes("potestad")) {
      matter = "familiar";
    } else if (q.includes("laboral") || q.includes("trabajo") || q.includes("empleo")) {
      matter = "laboral";
    } else if (q.includes("fiscal") || q.includes("impuesto") || q.includes("sat") || q.includes("isr") || q.includes("iva")) {
      matter = "fiscal";
    } else if (q.includes("cnpcf") || q.includes("procedimientos civiles y familiares") || q.includes("codigo nacional de procedimientos")) {
      matter = "cnpcf";
    } else if (q.includes("amparo") || q.includes("acto reclamado") || q.includes("suspension")) {
      matter = "amparo";
    } else if (q.includes("civil") || q.includes("contrato") || q.includes("sucesion") || q.includes("sucesión")) {
      matter = "civil";
    } else if (q.includes("mercantil") || q.includes("comercio") || q.includes("sociedad")) {
      matter = "mercantil";
    } else if (q.includes("boletin") || q.includes("boletín") || q.includes("sise") || q.includes("judicatura")) {
      matter = "judicial";
    } else if (q.includes("penal") || q.includes("delito") || q.includes("prisión")) {
      matter = "penal";
    }
  }

  // 1. Obtener dominios oficiales activos desde base de datos
  let activeSourcesList: Array<{ domain: string; name: string; slug: string }> = [];
  try {
    const dbSources = await prisma.officialSource.findMany({
      where: { isActive: true },
      select: { baseUrl: true, name: true, slug: true }
    });
    activeSourcesList = dbSources.map(s => {
      try {
        const url = new URL(s.baseUrl);
        return {
          domain: url.hostname.toLowerCase(),
          name: s.name,
          slug: s.slug.toLowerCase()
        };
      } catch (_) {
        return null;
      }
    }).filter((x): x is { domain: string; name: string; slug: string } => x !== null);
  } catch (err) {
    console.error("[expandLegalSearch] Error fetching active sources from DB:", err);
  }

  // Fallback a los dominios conocidos si la BD no retorna resultados
  const domainsToUse = activeSourcesList.length > 0 ? activeSourcesList : [
    { domain: "dof.gob.mx", name: "DOF", slug: "dof_web" },
    { domain: "sidof.segob.gob.mx", name: "SIDOF", slug: "sidof" },
    { domain: "diputados.gob.mx", name: "Cámara de Diputados", slug: "diputados" },
    { domain: "scjn.gob.mx", name: "SCJN", slug: "scjn_sjf" }
  ];

  const allowedDomainsStr = domainsToUse.map(d => `${d.domain} (${d.name})`).join(", ");

  try {
    const provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase().trim();
    const key = process.env[`${provider.toUpperCase()}_API_KEY`]?.trim();

    if (!key || provider === "local") {
      throw new Error("No API key available for LLM query expansion");
    }

    const prompt = `Actúa como un experto legal en México. Expande la siguiente consulta legal para optimizar la búsqueda federada en fuentes oficiales:
Consulta: "${query}"
Materia: "${matter || "no especificada"}"

Dominios permitidos: ${allowedDomainsStr}

Genera una respuesta en formato JSON estricto con la siguiente estructura:
{
  "alternativeTerms": ["término alternativo 1", "término alternativo 2"],
  "relatedAuthorities": [
    { "name": "Nombre de Autoridad (ej. SAT, SCJN)", "relevance": "alta", "reason": "Razón del enlace" }
  ],
  "legalTopics": ["tema relacionado 1"],
  "documentTypes": ["ley", "reforma", "tesis"],
  "officialSources": [
    { "domain": "dominio_permitido", "name": "Nombre de Fuente", "searchQuery": "consulta optimizada", "rationale": "Justificación" }
  ]
}

Reglas obligatorias:
1. Responde únicamente con el JSON estricto. No agregues bloques markdown ni texto aclaratorio.
2. Construye consultas cortas y específicas de palabras clave en 'searchQuery'.
3. CRÍTICO: El campo 'officialSources' SOLO puede contener dominios que estén exactamente en la lista de 'Dominios permitidos'. Cualquier otro dominio propuesto será ignorado y bloqueado por seguridad.`;

    const completion = await generateLlmCompletion(prompt);
    let clean = completion.answer.trim();
    if (clean.startsWith("```")) {
      clean = clean.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    }

    const parsed = JSON.parse(clean);

    // Filtrado estricto por servicio interno.
    const filteredSources = (Array.isArray(parsed.officialSources) ? parsed.officialSources : [])
      .map((s: any) => {
        const domain = (s.domain || "").trim().toLowerCase();
        const matched = domainsToUse.find(d => d.domain === domain || d.slug === domain);
        if (matched) {
          return {
            domain: matched.domain,
            name: matched.name,
            searchQuery: (s.searchQuery || query).trim(),
            rationale: (s.rationale || "").trim()
          };
        }
        return null;
      })
      .filter((s: any): s is { domain: string; name: string; searchQuery: string; rationale: string } => s !== null);

    const finalSources = filteredSources.length > 0 ? filteredSources : domainsToUse.slice(0, 3).map(d => ({
      domain: d.domain,
      name: d.name,
      searchQuery: query,
      rationale: "Default fallback (no source matched allowed list)"
    }));
    
    const expanded = {
      userQuery: query,
      userMatter: matter,
      expandedSearch: {
        alternativeTerms: Array.isArray(parsed.alternativeTerms) ? parsed.alternativeTerms : [query],
        relatedAuthorities: Array.isArray(parsed.relatedAuthorities) ? parsed.relatedAuthorities : [],
        legalTopics: Array.isArray(parsed.legalTopics) ? parsed.legalTopics : [],
        documentTypes: Array.isArray(parsed.documentTypes) ? parsed.documentTypes : [],
        officialSources: finalSources
      },
      searchStrategy: "buscar fuentes oficiales",
      warnings: [] as string[]
    };

    return {
      ok: true,
      provider: completion.provider,
      model: completion.model,
      fallback: false,
      expanded
    };
  } catch (error) {
    const fallbackMat = MATTER_FALLBACK[matter?.toLowerCase() || ""] || {
      terms: [query],
      authorities: [],
    };

    const expanded = {
      userQuery: query,
      userMatter: matter,
      expandedSearch: {
        alternativeTerms: fallbackMat.terms,
        relatedAuthorities: fallbackMat.authorities.map(a => ({
          name: a,
          relevance: 'alta',
          reason: 'Fallback'
        })),
        legalTopics: [] as string[],
        documentTypes: ['reforma', 'decreto', 'jurisprudencia'],
        officialSources: domainsToUse.slice(0, 3).map(d => ({
          domain: d.domain,
          name: d.name,
          searchQuery: query,
          rationale: "Fallback local por fallo de IA"
        }))
      },
      searchStrategy: "fallback local",
      warnings: [] as string[]
    };

    return {
      ok: true,
      provider: "local",
      model: "local",
      fallback: true,
      expanded
    };
  }
}

export function sanitizeLegalExpansion(expanded: any, options: { query: string; matter?: string }) {
  if (!expanded) return expanded;
  const warnings = Array.isArray(expanded.warnings) ? [...expanded.warnings] : [];

  const originalSources = expanded.expandedSearch?.officialSources || [];
  
  // Realizar sanitización estricta sincrónica contra la lista estática (o compatible)
  const sanitizedSources = originalSources.filter((source: any) => {
    const domain = (source.domain || "").trim().toLowerCase();
    const isAllowed = ALLOWED_OFFICIAL_DOMAINS.includes(domain);
    if (!isAllowed) {
      warnings.push(`Dominio descartado por seguridad: ${source.domain}`);
    }
    return isAllowed;
  });

  return {
    ...expanded,
    expandedSearch: {
      ...(expanded.expandedSearch || {}),
      officialSources: sanitizedSources
    },
    warnings
  };
}
