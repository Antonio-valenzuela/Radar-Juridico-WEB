/**
 * worker/legalReportWorker.ts
 *
 * BullMQ worker that processes async legal report jobs.
 *
 * Job lifecycle: QUEUED → SEARCHING → ANALYZING → COMPLETED | FAILED
 *
 * Run with: npx tsx worker/legalReportWorker.ts
 */

import { Worker, type Job } from "bullmq";
import { connection } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { hybridSearch } from "@/lib/search/hybridSearch";
import { expandLegalSearch } from "@/lib/search/legalExpansion";
import { searchOfficialSources } from "@/lib/search/officialFederatedSearch";
import { generateLlmCompletion } from "@/lib/ai-provider";
import {
  LOCAL_SEARCH_MS,
  EXTERNAL_SEARCH_MS,
  PER_SOURCE_MS,
  AI_SYNTHESIS_MS,
} from "@/lib/config/timeouts";

interface LegalReportPayload {
  processingJobId: string;
  query: string;
  filters?: Record<string, any>;
  materia?: string;
  fuente?: string;
  autoridad?: string;
  dateFrom?: string;
  dateTo?: string;
  mode?: string;
  localResults?: any[];
}

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout:${ms}ms`)), ms)),
  ]).catch(() => fallback);
}

export async function processLegalReport(job: Job<LegalReportPayload>) {
  const {
    processingJobId,
    query,
    filters,
    materia,
    fuente,
    autoridad,
    dateFrom,
    dateTo,
    mode,
  } = job.data;

  const updateJob = async (status: string, stage: string, progress: number, extraData: Partial<Prisma.ProcessingJobUpdateInput> = {}) => {
    await prisma.processingJob.update({
      where: { id: processingJobId },
      data: {
        status,
        stage,
        progress,
        ...extraData,
      },
    });
    await job.updateProgress(progress);
  };

  try {
    // ── Step 1: Searching (Local DB) ──────────────────────────────────────────
    await updateJob("PROCESSING", "searching", 15, { startedAt: new Date() });

    // Parse filters for hybridSearch
    const filtersParsed = {
      fuente: fuente ? [fuente] : undefined,
      materia: materia ? [materia] : undefined,
      fecha_desde: dateFrom || undefined,
      fecha_hasta: dateTo || undefined,
    };

    const localResults = await withTimeout(
      hybridSearch(query, filtersParsed, 10),
      LOCAL_SEARCH_MS,
      []
    );

    // ── Step 2: Collecting external sources ──────────────────────────────────
    await updateJob("PROCESSING", "collecting_sources", 40);

    const expansionRes = await withTimeout(
      expandLegalSearch({ query, matter: materia }),
      4000,
      null
    );

    const officialSources = expansionRes?.expanded?.expandedSearch?.officialSources ?? [
      { domain: "dof.gob.mx", name: "DOF", searchQuery: query, rationale: "" },
    ];

    // Filter official sources if a specific one was requested
    const filteredSources = fuente 
      ? officialSources.filter((s: any) => s.name.toLowerCase() === fuente.toLowerCase() || s.domain.toLowerCase().includes(fuente.toLowerCase()))
      : officialSources;

    const { results: externalResults } = await withTimeout(
      searchOfficialSources(filteredSources.length > 0 ? filteredSources : officialSources, { dateFrom, dateTo }, PER_SOURCE_MS),
      EXTERNAL_SEARCH_MS,
      { results: [], warnings: [] }
    );

    // ── Step 3: AI Analysis ──────────────────────────────────────────────────
    await updateJob("PROCESSING", "analyzing", 65);

    const hasResults =
      localResults.length > 0 ||
      externalResults.some((g: any) => (g.results?.length ?? 0) > 0);

    let aiAnalysis = null;
    if (hasResults) {
      const prompt = buildPrompt(query, localResults, externalResults);
      const llmResult = await withTimeout(
        generateLlmCompletion(prompt, "rag_answer"),
        AI_SYNTHESIS_MS,
        null
      );

      // ── Step 4: Generating summary ──────────────────────────────────────────
      await updateJob("PROCESSING", "generating_summary", 85);

      if (llmResult) {
        try {
          let clean = llmResult.answer.trim();
          if (clean.startsWith("```")) clean = clean.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
          const parsed = JSON.parse(clean);
          aiAnalysis = {
            summary: parsed.summary ?? "",
            legalImpact: parsed.legalImpact ?? "",
            attentionPoints: Array.isArray(parsed.attentionPoints) ? parsed.attentionPoints : [],
            provider: llmResult.provider,
            model: llmResult.model,
          };
        } catch {
          aiAnalysis = { summary: llmResult.answer, legalImpact: "", attentionPoints: [] };
        }
      }
    } else {
      // ── Step 4: Generating summary (empty case) ─────────────────────────────
      await updateJob("PROCESSING", "generating_summary", 85);
      aiAnalysis = {
        summary: "No se encontró evidencia suficiente para generar un reporte confiable con los filtros actuales.",
        legalImpact: "Sin impacto detectado.",
        attentionPoints: [],
      };
    }

    // ── Step 5: Save structured result JSON ──────────────────────────────────
    const resultJson: Prisma.InputJsonValue = {
      query,
      filters: (filters || {}) as Prisma.InputJsonValue,
      generatedAt: new Date().toISOString(),
      resumenEjecutivo: String(aiAnalysis?.summary || "No se encontró evidencia suficiente para generar un reporte confiable con los filtros actuales."),
      puntosRelevantes: Array.isArray(aiAnalysis?.attentionPoints) ? aiAnalysis.attentionPoints.map(String) : [],
      fuentesConsultadas: Array.isArray(externalResults) 
        ? externalResults.map((e: any) => String(e.source || e.name || "Desconocida"))
        : [],
      documentosEncontrados: localResults.slice(0, 10).map(r => ({
        titulo: String(r.documento),
        fuente: String(r.fuente),
        fecha: String(r.fecha),
        fragmento: String(r.fragmento_relevante),
        similitudSemantica: Number(r.coincidencia_semantica),
        coincidenciaTextual: Number(r.coincidencia_textual),
      })),
      criteriosRelevancia: {
        umbralSemantico: 0.35,
        ordenamiento: "Score Híbrido (Texto 40% + Semántica 60%)",
      },
      posiblesImpactos: String(aiAnalysis?.legalImpact || "Sin impacto detectado."),
      recomendacionesRevision: [
        "Verificar vigencia en los portales oficiales correspondientes.",
        "Cruzar con reglamentos locales aplicables al sector del cliente."
      ],
      trazabilidad: {
        fecha: new Date().toISOString(),
        query,
        filtros: (filters || {}) as Prisma.InputJsonValue,
        fuentes: Array.isArray(externalResults) 
          ? externalResults.map((e: any) => String(e.source || e.name || "Desconocida"))
          : []
      }
    };

    await prisma.processingJob.update({
      where: { id: processingJobId },
      data: {
        status: "COMPLETED",
        stage: "completed",
        progress: 100,
        result: resultJson,
        finishedAt: new Date(),
      },
    });

    await job.updateProgress(100);
    return resultJson;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await prisma.processingJob.update({
      where: { id: processingJobId },
      data: {
        status: "FAILED",
        stage: "failed",
        progress: 0,
        error: errorMsg,
        finishedAt: new Date(),
      },
    });
    throw err;
  }
}

function buildPrompt(query: string, localResults: unknown[], externalResults: unknown[]): string {
  return `Actúa como un analista legal experto en México.
Consulta: "${query}"

Resultados locales:
${JSON.stringify(localResults.slice(0, 5), null, 2)}

Resultados externos:
${JSON.stringify(externalResults.slice(0, 5), null, 2)}

Genera un JSON con exactamente:
{
  "summary": "Resumen ejecutivo basado en evidencia provista.",
  "legalImpact": "Impacto jurídico práctico para abogados en México.",
  "attentionPoints": ["Punto 1", "Punto 2"]
}
NO inventes URLs, fechas o leyes. Si no hay evidencia suficiente, usa el mensaje estándar de "no evidencia".
Responde ÚNICAMENTE con el JSON.`;
}

// ─── Worker startup ──────────────────────────────────────────────────────────

function startLegalReportWorker() {
  const worker = new Worker<LegalReportPayload>(
    "legal-reports",
    processLegalReport,
    {
      connection: connection as any,
      concurrency: 2,
      limiter: {
        max: 10,
        duration: 60_000, // max 10 jobs per minute
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[legal-report-worker] ✅ Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[legal-report-worker] ❌ Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[legal-report-worker] Worker error:", err);
  });

  console.log("[legal-report-worker] 🚀 Started, listening for legal-reports queue...");
  return worker;
}

const normalizedEntryPoint = (process.argv[1] || "").replace(/\\/g, "/");
const isDirectWorkerRun =
  normalizedEntryPoint.endsWith("/worker/legalReportWorker.ts") ||
  normalizedEntryPoint.endsWith("/worker/legalReportWorker.js");

if (isDirectWorkerRun) {
  startLegalReportWorker();
}
