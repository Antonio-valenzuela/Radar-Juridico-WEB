import { PrismaClient } from "@prisma/client";

type MonitoringStatus = "active" | "error" | "blocked";

type MonitoredDocumentSeed = {
  shortCode: string;
  title: string;
  matter: string;
  jurisdiction: string;
  documentType: string;
  officialUrl: string;
  summary: string;
};

type UrlValidationResult = {
  monitoringStatus: MonitoringStatus;
  lastError: string | null;
  httpStatus: number | null;
};

export const MONITORED_DOCUMENTS: MonitoredDocumentSeed[] = [
  {
    shortCode: "CPEUM",
    title: "Constitucion Politica de los Estados Unidos Mexicanos",
    matter: "constitucional/amparo",
    jurisdiction: "Federal",
    documentType: "constitucion",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf",
    summary: "Texto constitucional federal monitoreado desde Camara de Diputados.",
  },
  {
    shortCode: "LAmp",
    title: "Ley de Amparo",
    matter: "amparo",
    jurisdiction: "Federal",
    documentType: "ley",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LAmp.pdf",
    summary: "Ley de Amparo monitoreada para detectar reformas publicadas en la fuente oficial.",
  },
  {
    shortCode: "CPF",
    title: "Codigo Penal Federal",
    matter: "penal",
    jurisdiction: "Federal",
    documentType: "codigo",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CPF.pdf",
    summary: "Codigo Penal Federal monitoreado para cambios normativos relevantes.",
  },
  {
    shortCode: "CCF",
    title: "Codigo Civil Federal",
    matter: "civil",
    jurisdiction: "Federal",
    documentType: "codigo",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf",
    summary: "Codigo Civil Federal monitoreado como documento base en materia civil.",
  },
  {
    shortCode: "CCom",
    title: "Codigo de Comercio",
    matter: "mercantil",
    jurisdiction: "Federal",
    documentType: "codigo",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CCom.pdf",
    summary: "Codigo de Comercio monitoreado para litigio y practica mercantil.",
  },
  {
    shortCode: "LFT",
    title: "Ley Federal del Trabajo",
    matter: "laboral",
    jurisdiction: "Federal",
    documentType: "ley",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFT.pdf",
    summary: "Ley laboral federal monitoreada para cambios con impacto en relaciones de trabajo.",
  },
  {
    shortCode: "CFF",
    title: "Codigo Fiscal de la Federacion",
    matter: "fiscal",
    jurisdiction: "Federal",
    documentType: "codigo",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CFF.pdf",
    summary: "Codigo Fiscal de la Federacion monitoreado para obligaciones fiscales y recursos.",
  },
  {
    shortCode: "LAD",
    title: "Ley Aduanera",
    matter: "aduanero/comercio exterior",
    jurisdiction: "Federal",
    documentType: "ley",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LAdua.pdf",
    summary: "Ley Aduanera monitoreada para operaciones de comercio exterior.",
  },
  {
    shortCode: "LCE",
    title: "Ley de Comercio Exterior",
    matter: "comercio exterior/mercantil",
    jurisdiction: "Federal",
    documentType: "ley",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LCE.pdf",
    summary: "Ley de Comercio Exterior monitoreada desde la URL oficial legible de Diputados.",
  },
  {
    shortCode: "LSS",
    title: "Ley del Seguro Social",
    matter: "seguridad social/laboral",
    jurisdiction: "Federal",
    documentType: "ley",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LSS.pdf",
    summary: "Ley del Seguro Social monitoreada para obligaciones patronales y seguridad social.",
  },
  {
    shortCode: "CNPCF",
    title: "Codigo Nacional de Procedimientos Civiles y Familiares",
    matter: "civil/familiar/procesal",
    jurisdiction: "Nacional",
    documentType: "codigo",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CNPCF.pdf",
    summary: "Codigo procesal nacional monitoreado por su implementacion gradual civil y familiar.",
  },
  {
    shortCode: "CNPP",
    title: "Codigo Nacional de Procedimientos Penales",
    matter: "penal/procesal",
    jurisdiction: "Nacional",
    documentType: "codigo",
    officialUrl: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CNPP.pdf",
    summary: "Codigo procesal penal nacional monitoreado para cambios en procedimiento penal.",
  },
];

const OFFICIAL_SOURCE = {
  name: "Camara de Diputados",
  slug: "camara-diputados-leyes-biblio",
  baseUrl: "https://www.diputados.gob.mx/LeyesBiblio/index.htm",
  healthUrl: "https://www.diputados.gob.mx/LeyesBiblio/index.htm",
  adapter: "DIPUTADOS_LEYES_BIBLIO",
  type: "diputados",
  jurisdiction: "MX",
  country: "MX",
  description: "Repositorio oficial de leyes federales vigentes de la Camara de Diputados.",
  crawlMode: "manual_url",
  refreshFrequency: "manual",
};

function canonicalKeyFor(document: MonitoredDocumentSeed) {
  return `mx:federal:diputados:${document.shortCode.toLowerCase()}`;
}

function parseArgs(argv: string[]) {
  return {
    dryRun: argv.includes("--dry-run"),
    skipUrlValidation: argv.includes("--skip-url-validation"),
  };
}

function classifyHttpStatus(status: number): UrlValidationResult {
  if (status >= 200 && status < 400) {
    return { monitoringStatus: "active", lastError: null, httpStatus: status };
  }

  if ([401, 403, 405, 429].includes(status)) {
    return {
      monitoringStatus: "blocked",
      lastError: `La fuente oficial respondio HTTP ${status}; requiere revision manual.`,
      httpStatus: status,
    };
  }

  return {
    monitoringStatus: "error",
    lastError: `La fuente oficial respondio HTTP ${status}.`,
    httpStatus: status,
  };
}

export async function validateOfficialUrl(url: string, timeoutMs = 8000): Promise<UrlValidationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "JuridicoRadar/1.0 legal-change-monitor",
      },
    });

    return classifyHttpStatus(response.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo validar la URL oficial.";
    const isAbort = error instanceof Error && error.name === "AbortError";

    return {
      monitoringStatus: "error",
      lastError: isAbort ? "La fuente oficial no respondio dentro del tiempo limite." : message,
      httpStatus: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function validateSeedDocuments(skipUrlValidation: boolean) {
  const checkedAt = new Date();
  const results: Array<MonitoredDocumentSeed & UrlValidationResult & { canonicalKey: string; checkedAt: Date }> = [];

  for (const document of MONITORED_DOCUMENTS) {
    const validation = skipUrlValidation
      ? { monitoringStatus: "active" as const, lastError: null, httpStatus: null }
      : await validateOfficialUrl(document.officialUrl);

    results.push({
      ...document,
      ...validation,
      canonicalKey: canonicalKeyFor(document),
      checkedAt,
    });
  }

  return results;
}

function printSummary(params: {
  dryRun: boolean;
  results: Awaited<ReturnType<typeof validateSeedDocuments>>;
  saved: number;
}) {
  const active = params.results.filter((item) => item.monitoringStatus === "active").length;
  const blocked = params.results.filter((item) => item.monitoringStatus === "blocked").length;
  const errors = params.results.filter((item) => item.monitoringStatus === "error").length;

  console.log(
    JSON.stringify(
      {
        ok: errors === 0,
        mode: params.dryRun ? "dry-run" : "write",
        reviewed: params.results.length,
        active,
        blocked,
        errors,
        saved: params.saved,
        documents: params.results.map((item) => ({
          shortCode: item.shortCode,
          title: item.title,
          monitoringStatus: item.monitoringStatus,
          officialUrl: item.officialUrl,
          httpStatus: item.httpStatus,
          lastError: item.lastError,
        })),
      },
      null,
      2,
    ),
  );
}

async function saveDocuments(results: Awaited<ReturnType<typeof validateSeedDocuments>>) {
  const prisma = new PrismaClient();
  let saved = 0;

  try {
    const source = await prisma.officialSource.upsert({
      where: { slug: OFFICIAL_SOURCE.slug },
      update: {
        name: OFFICIAL_SOURCE.name,
        baseUrl: OFFICIAL_SOURCE.baseUrl,
        healthUrl: OFFICIAL_SOURCE.healthUrl,
        adapter: OFFICIAL_SOURCE.adapter,
        type: OFFICIAL_SOURCE.type,
        jurisdiction: OFFICIAL_SOURCE.jurisdiction,
        country: OFFICIAL_SOURCE.country,
        description: OFFICIAL_SOURCE.description,
        isActive: true,
        isOfficial: true,
        trustLevel: "official",
        crawlMode: OFFICIAL_SOURCE.crawlMode,
        refreshFrequency: OFFICIAL_SOURCE.refreshFrequency,
        lastCheckedAt: new Date(),
      },
      create: {
        ...OFFICIAL_SOURCE,
        isActive: true,
        isOfficial: true,
        trustLevel: "official",
        lastCheckedAt: new Date(),
      },
    });

    for (const item of results) {
      const existing = await prisma.document.findFirst({
        where: {
          OR: [{ canonicalKey: item.canonicalKey }, { canonicalUrl: item.officialUrl }, { officialUrl: item.officialUrl }],
        },
        select: { id: true },
      });

      const data = {
        source: "DIPUTADOS",
        jurisdiction: item.jurisdiction,
        documentType: item.documentType,
        title: item.title,
        canonicalKey: item.canonicalKey,
        canonicalUrl: item.officialUrl,
        summary: item.summary,
        shortCode: item.shortCode,
        matter: item.matter,
        officialSourceId: source.id,
        officialUrl: item.officialUrl,
        officialSourceUrl: OFFICIAL_SOURCE.baseUrl,
        monitoringStatus: item.monitoringStatus,
        lastError: item.lastError,
        lastCheckedAt: item.checkedAt,
        changeSummary: "Documento registrado para monitoreo de cambios en fuente oficial.",
      };

      if (existing) {
        await prisma.document.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await prisma.document.create({ data });
      }

      saved += 1;
    }

    return saved;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const results = await validateSeedDocuments(args.skipUrlValidation);
  const saved = args.dryRun ? 0 : await saveDocuments(results);

  printSummary({ dryRun: args.dryRun, results, saved });
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "No se pudo preparar el seed de monitoreo legal.";
    console.error(message);
    process.exitCode = 1;
  });
}
