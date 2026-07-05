import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { consultantPromptVersion, maybeGenerateLlmReport } from "@/lib/consultant/llm";
import type { ConsultantInputChange, ConsultantReport } from "@/lib/consultant/types";

const PUBLIC_TYPES = new Set(["LEY", "CODIGO", "REGLAMENTO", "DECRETO", "ACUERDO", "JURISPRUDENCIA", "TESIS"]);

type ConsultantInput = {
  title: string;
  source: string;
  published: string;
  tipo: string | null;
  tema: string | null;
  impacto: string | null;
  summary: string | null;
  diffBullets: string[];
  changedArticles: ConsultantInputChange[];
};

export async function getOrCreateConsultantInsight(itemId: string, force = false) {
  const context = await loadContext(itemId);
  if (!context) return null;

  const inputHash = hashContext(context.input);
  if (!force) {
    const existing = await prisma.consultantInsight.findFirst({
      where: { itemId, inputHash, promptVersion: consultantPromptVersion() },
      orderBy: { generatedAt: "desc" },
    });
    if (existing) return serializeInsight(existing);
  }

  const llmReport = PUBLIC_TYPES.has(context.item.tipo || "")
    ? await maybeGenerateLlmReport(context.input)
    : null;
  const report = llmReport || deterministicReport(context.input);

  const saved = await prisma.consultantInsight.upsert({
    where: {
      itemId_inputHash_promptVersion: {
        itemId,
        inputHash,
        promptVersion: report.promptVersion,
      },
    },
    update: toDbUpdate(report, context.diffId),
    create: {
      itemId,
      diffId: context.diffId,
      inputHash,
      ...toDbCreate(report),
    },
  });

  return serializeInsight(saved);
}

async function loadContext(itemId: string) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      normaVersions: {
        include: {
          norma: true,
          diffsTo: true,
        },
        orderBy: { publishedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!item) return null;

  const version = item.normaVersions[0] || null;
  const diff = version?.diffsTo[0] || null;
  const diffBullets = Array.isArray(diff?.summaryBullets)
    ? diff.summaryBullets.map((x) => String(x)).slice(0, 5)
    : [];
  const changedArticles = Array.isArray(diff?.changedArticles)
    ? (diff.changedArticles as ConsultantInputChange[]).slice(0, 12)
    : [];

  return {
    item,
    diffId: diff?.id || null,
    input: {
      title: item.title,
      source: item.source,
      published: item.published.toISOString(),
      tipo: item.tipo,
      tema: item.tema,
      impacto: item.impacto,
      summary: item.summary?.slice(0, 1400) || null,
      diffBullets,
      changedArticles,
    },
  };
}

function deterministicReport(input: ConsultantInput): ConsultantReport {
  const topic = input.tema || "general";
  const type = input.tipo || "documento";
  const impact = input.impacto || "bajo";
  const changes = input.changedArticles;
  const diffBullets = input.diffBullets.length ? input.diffBullets : ["No hay comparacion por articulo disponible."];

  const keyChanges = changes.length
    ? changes.slice(0, 5).map((change) => {
        const label = change.title || change.articleId || "Seccion";
        if (change.changeType === "added") return `${label}: se agrega texto nuevo.`;
        if (change.changeType === "removed") return `${label}: se elimina texto previo.`;
        return `${label}: se modifica el contenido vigente.`;
      })
    : diffBullets.slice(0, 5);

  return {
    executiveSummary:
      `Actualizacion ${type.toLowerCase()} de impacto ${impact} en materia ${topic}. ` +
      "Revise el texto oficial antes de tomar decisiones; este analisis es orientativo.",
    keyChanges,
    affectedParties: inferAffectedParties(input),
    actionItems: [
      "Abrir la fuente oficial y confirmar fecha de publicacion y entrada en vigor.",
      "Comparar el cambio contra expedientes, contratos, politicas internas o criterios aplicables.",
      "Separar cambios inmediatos de cambios sujetos a transitorios.",
      "Guardar evidencia de la fuente consultada para trazabilidad.",
    ],
    riskFlags: inferRisks(input),
    followUpQuestions: [
      "Tiene transitorios o fecha especial de entrada en vigor?",
      "Deroga, adiciona o reforma obligaciones existentes?",
      "Afecta procedimientos abiertos o solo casos futuros?",
      "Requiere actualizar formatos, avisos, contratos o criterios internos?",
    ],
    confidence: changes.length || input.summary ? "media" : "baja",
    provider: "deterministic",
    model: "rules-consultant-v1",
    promptVersion: consultantPromptVersion(),
  };
}

function inferAffectedParties(input: ConsultantInput) {
  const text = `${input.title} ${input.summary || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const parties: string[] = [];

  if (/fiscal|impuesto|sat|hacienda|iva|isr|ieps|contribu/.test(text)) parties.push("Contribuyentes, contadores, fiscalistas y areas de cumplimiento.");
  if (/penal|fiscalia|delito|victima|imputado/.test(text)) parties.push("Defensas, fiscalias, victimas, imputados y litigantes penales.");
  if (/civil|familiar|alimentos|divorcio|sucesion|arrendamiento/.test(text)) parties.push("Particulares, familias, notariales y litigantes civiles/familiares.");
  if (/laboral|trabajo|imss|infonavit|seguridad social/.test(text)) parties.push("Patrones, trabajadores, sindicatos y areas de recursos humanos.");
  if (/mercantil|comercio|sociedad|credito|financier/.test(text)) parties.push("Empresas, instituciones financieras, areas corporativas y cumplimiento.");
  if (/salud|sanitario|cofepris|medicamento/.test(text)) parties.push("Instituciones de salud, proveedores, farmaceuticas y regulatorio sanitario.");
  if (/energia|telecom|electric|hidrocarburo|petrol/.test(text)) parties.push("Concesionarios, permisionarios, regulados y asesores de energia/telecom.");

  if (parties.length === 0) parties.push("Abogados, areas juridicas y sujetos regulados relacionados con la publicacion.");
  return parties.slice(0, 5);
}

function inferRisks(input: ConsultantInput) {
  const text = `${input.title} ${input.summary || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const risks: string[] = [];

  if (/ENTRA EN VIGOR|TRANSITORIOS/.test(text)) risks.push("Puede haber plazos o entrada en vigor diferenciada.");
  if (/DEROGA|ABROGA/.test(text)) risks.push("Puede dejar sin efecto reglas o referencias usadas en documentos actuales.");
  if (/ADICIONA|REFORMA|EXPIDE/.test(text)) risks.push("Puede crear nuevas obligaciones o modificar procesos existentes.");
  if (input.impacto === "alto") risks.push("Conviene revisar de inmediato por su clasificacion de alto impacto.");
  if (input.changedArticles.length === 0) risks.push("No hay diff por articulo; validar manualmente el texto oficial.");

  return risks.slice(0, 5);
}

function hashContext(input: object) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function toDbCreate(report: ConsultantReport) {
  return {
    provider: report.provider,
    model: report.model,
    promptVersion: report.promptVersion,
    executiveSummary: report.executiveSummary,
    keyChanges: report.keyChanges as unknown as Prisma.InputJsonValue,
    affectedParties: report.affectedParties as unknown as Prisma.InputJsonValue,
    actionItems: report.actionItems as unknown as Prisma.InputJsonValue,
    riskFlags: report.riskFlags as unknown as Prisma.InputJsonValue,
    followUpQuestions: report.followUpQuestions as unknown as Prisma.InputJsonValue,
    confidence: report.confidence,
  };
}

function toDbUpdate(report: ConsultantReport, diffId: string | null) {
  return {
    diffId,
    ...toDbCreate(report),
  };
}

function serializeInsight(insight: {
  id: string;
  itemId: string;
  diffId: string | null;
  provider: string;
  model: string;
  promptVersion: string;
  inputHash: string;
  executiveSummary: string;
  keyChanges: Prisma.JsonValue;
  affectedParties: Prisma.JsonValue;
  actionItems: Prisma.JsonValue;
  riskFlags: Prisma.JsonValue;
  followUpQuestions: Prisma.JsonValue;
  confidence: string;
  generatedAt: Date;
  updatedAt: Date;
}) {
  return {
    ...insight,
    generatedAt: insight.generatedAt.toISOString(),
    updatedAt: insight.updatedAt.toISOString(),
  };
}
