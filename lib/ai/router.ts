import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { classifyError, classifyResponse, isFallbackEligible } from "./errorClassifier";
import { analyzeWithLocalRules } from "./localRulesProvider";
import { matchAlertRule as matchAlertRuleLocally } from "./alertMatcher";
import { analyzeLegalImage as analyzeLegalImageWithProvider } from "./visionProvider";
import { searchRecentContext as searchRecentContextWithProvider } from "./recentContextProvider";
import { generateWeeklyDigest as generateWeeklyDigestLocally } from "./weeklyDigest";
import type {
  AlertMatchInput,
  AnalyzeLegalImageInput,
  AnalyzeLegalTextInput,
  RecentContextInput,
  WeeklyDigestDocument,
} from "./tasks";
import type { LegalAiAnalysis, LegalAiInput } from "./types";
import { buildLegalAiPrompt, sanitizeLegalAiAnalysis, extractJsonObject } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProviderChain(): string[] {
  const chainStr = process.env.AI_PROVIDER_CHAIN || "gemini,groq,openrouter,local";
  return chainStr.split(",").map(p => p.trim().toLowerCase()).filter(Boolean);
}

function getProviderTimeoutMs(provider: string): number {
  const defaultTimeout = provider === "openrouter" ? 10000 : 8000;
  const envTimeout = process.env.AI_PROVIDER_TIMEOUT_MS ? Number(process.env.AI_PROVIDER_TIMEOUT_MS) : null;
  return envTimeout && Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : defaultTimeout;
}

function parseTokenUsage(data: any): { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } {
  if (!data) return { promptTokens: null, completionTokens: null, totalTokens: null };

  if (data.usage) {
    return {
      promptTokens: Number(data.usage.prompt_tokens) || null,
      completionTokens: Number(data.usage.completion_tokens) || null,
      totalTokens: Number(data.usage.total_tokens) || null,
    };
  }

  if (data.usageMetadata) {
    return {
      promptTokens: Number(data.usageMetadata.promptTokenCount) || null,
      completionTokens: Number(data.usageMetadata.candidatesTokenCount) || null,
      totalTokens: Number(data.usageMetadata.totalTokenCount) || null,
    };
  }

  return { promptTokens: null, completionTokens: null, totalTokens: null };
}

function calculateEstimatedCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): { cost: number; source: string } {
  const prov = provider.toLowerCase().trim();
  const mdl = model.toLowerCase().trim();

  if (prov === "gemini") {
    const inputPrice = 0.075 / 1000000;
    const outputPrice = 0.30 / 1000000;
    return {
      cost: promptTokens * inputPrice + completionTokens * outputPrice,
      source: "estimated"
    };
  }

  if (prov === "groq") {
    const inputPrice = 0.05 / 1000000;
    const outputPrice = 0.08 / 1000000;
    return {
      cost: promptTokens * inputPrice + completionTokens * outputPrice,
      source: "estimated"
    };
  }

  if (prov === "openrouter") {
    if (mdl.includes("free")) {
      return { cost: 0.0, source: "provider_metadata" };
    }
    const inputPrice = 0.50 / 1000000;
    const outputPrice = 1.50 / 1000000;
    return {
      cost: promptTokens * inputPrice + completionTokens * outputPrice,
      source: "estimated"
    };
  }

  return { cost: 0.0, source: "unavailable" };
}

function parseRateLimitHeaders(headers: any, provider: string) {
  const prov = provider.toLowerCase().trim();
  if (prov === "groq" && headers && typeof headers.get === "function") {
    const limit = headers.get("x-ratelimit-limit-requests");
    const remaining = headers.get("x-ratelimit-remaining-requests");
    const reset = headers.get("x-ratelimit-reset-requests");
    if (limit || remaining || reset) {
      return {
        rateLimitLimit: limit ? parseInt(limit, 10) : null,
        rateLimitRemaining: remaining ? parseInt(remaining, 10) : null,
        rateLimitResetAt: reset || null,
        rateLimitSource: "provider_headers"
      };
    }
  }
  return {
    rateLimitLimit: null,
    rateLimitRemaining: null,
    rateLimitResetAt: null,
    rateLimitSource: "unavailable"
  };
}
async function persistLog(params: {
  provider: string;
  model: string | null;
  operation: string;
  status: string;
  reasonCategory: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  costSource: string | null;
  durationMs: number;
  fallbackUsed: boolean;
  requestId: string | null;
  rateLimitLimit?: number | null;
  rateLimitRemaining?: number | null;
  rateLimitResetAt?: string | null;
  rateLimitSource?: string | null;
  mode?: string;
  route?: string;
  strategy?: string;
  fallbackRank?: number;
}) {
  try {
    const { trackAiUsage } = await import("./usageTracker");
    await trackAiUsage({
      requestId: params.requestId || "req_" + Math.random().toString(36).substring(7),
      provider: params.provider,
      model: params.model,
      strategy: params.strategy || "chain",
      fallbackRank: params.fallbackRank ?? (params.fallbackUsed ? 1 : 0),
      inputTokens: params.promptTokens,
      outputTokens: params.completionTokens,
      totalTokens: params.totalTokens,
      estimatedCost: params.estimatedCostUsd,
      latencyMs: params.durationMs,
      success: params.status === "success",
      errorCode: params.reasonCategory,
      route: params.route || null,
      mode: params.mode || params.operation,
    });
  } catch (err) {
    console.error("[persistLog] failed to track usage:", err);
  }

  if (process.env.AI_ENABLE_USAGE_TRACKING === "false") return;
  try {
    await prisma.aiUsageLog.create({
      data: {
        provider: params.provider,
        model: params.model,
        operation: params.operation,
        status: params.status,
        reasonCategory: params.reasonCategory,
        promptTokens: params.promptTokens,
        completionTokens: params.completionTokens,
        totalTokens: params.totalTokens,
        estimatedCostUsd: params.estimatedCostUsd != null ? new Prisma.Decimal(params.estimatedCostUsd.toFixed(6)) : null,
        costSource: params.costSource,
        durationMs: params.durationMs,
        fallbackUsed: params.fallbackUsed,
        requestId: params.requestId,
        rateLimitLimit: params.rateLimitLimit,
        rateLimitRemaining: params.rateLimitRemaining,
        rateLimitResetAt: params.rateLimitResetAt,
        rateLimitSource: params.rateLimitSource,
      }
    });
  } catch (err) {
    console.error("[logAiUsage] Failed to save AI usage log to DB:", err);
  }
}

function getLocalFallbackText(prompt: string, operation: string): string {
  const chatOperations = new Set([
    "general",
    "general_platform_help",
    "latest_changes",
    "search_help",
    "empty_search_assistant",
    "document_qa",
    "rag",
    "admin_source_diagnostic",
  ]);

  if (chatOperations.has(operation)) {
    const userMessageMatch = prompt.match(/\[MENSAJE DEL USUARIO\]:\s*"([^"]+)"/);
    const userMessage = (userMessageMatch?.[1] || "").toLowerCase();
    let answer = "Puedo orientarte de forma informativa. Para una petición jurídica, precisa hechos relevantes, materia, jurisdicción, fechas, documentos disponibles y el objetivo que buscas. Con eso puedo ayudarte a ordenar argumentos, riesgos, pruebas y fuentes oficiales a verificar.";

    if (operation === "latest_changes") {
      answer = "Puedo ayudarte a revisar cambios recientes con una búsqueda jurídica filtrada por materia y fecha. Usa la acción de búsqueda para consultar registros oficiales disponibles; si el resultado es parcial, valida directamente en DOF, SIDOF, SCJN o la fuente oficial aplicable antes de tomar una decisión jurídica.";
    } else if (operation === "empty_search_assistant") {
      answer = "No tengo una coincidencia suficiente para esa búsqueda en este momento. Prueba con términos más amplios, revisa la fuente oficial aplicable o agrega una URL jurídica específica para analizarla.";
    } else if (operation === "document_qa" || operation === "rag") {
      answer = "Para responder sobre un documento específico necesito el texto o fragmentos recuperados. Si me compartes el contenido relevante, puedo ayudarte a resumirlo, detectar riesgos y preparar puntos de revisión.";
    } else if (operation === "admin_source_diagnostic") {
      answer = "Puedo ayudarte a revisar una fuente oficial desde una perspectiva operativa: URL configurada, modo de ingesta, último resultado, errores visibles y siguiente acción sugerida.";
    } else if (userMessage.includes("despido") || userMessage.includes("laboral") || userMessage.includes("demanda")) {
      answer = "Para preparar una demanda laboral por despido, revisa al menos: relación de trabajo y patrón correcto; fecha y forma del despido; salario integrado y prestaciones; antigüedad; pruebas disponibles; constancias de conciliación si aplican; prestaciones reclamadas; plazos de caducidad o prescripción; y competencia de la autoridad. También conviene separar hechos, pruebas y pretensiones para que la narrativa sea clara.";
    }

    return JSON.stringify({
      answer: `${answer}\n\n⚠️ Respuesta generada por IA; verifica con fuentes oficiales.`,
      citations: [],
      suggestedActions: [],
    });
  }

  if (operation === "query_expansion") {
    const queryMatch = prompt.match(/Consulta:\s*"([^"]+)"/);
    const query = queryMatch ? queryMatch[1] : "consulta";
    return JSON.stringify({
      alternativeTerms: [query],
      relatedAuthorities: [],
      legalTopics: [],
      documentTypes: ["reforma", "decreto", "jurisprudencia"],
      officialSources: [
        { domain: "dof.gob.mx", name: "DOF", searchQuery: query, rationale: "" },
        { domain: "diputados.gob.mx", name: "Cámara de Diputados", searchQuery: query, rationale: "" }
      ]
    });
  }

  if (operation === "consultant_report") {
    return JSON.stringify({
      executiveSummary: "Resultado jurídico actualizado: no se detectó evidencia concluyente con la información local disponible. Valida el texto final en fuentes oficiales antes de presentar escrito.",
      keyChanges: ["Sin cambio confirmado con el contexto local disponible."],
      affectedParties: ["Partes por determinar según expediente, materia y jurisdicción."],
      actionItems: ["Revisar DOF/SIDOF, SCJN/SJF, Cámara de Diputados, CJF/SISE o boletín estatal aplicable."],
      riskFlags: ["Resultado local; requiere verificación directa en fuentes oficiales."],
      followUpQuestions: [],
      confidence: "baja"
    });
  }

  if (prompt.toLowerCase().includes("json")) {
    return JSON.stringify({
      summary: "No se encontró evidencia suficiente en fuentes oficiales registradas.",
      legalImpact: "Sin impacto detectado.",
      attentionPoints: []
    });
  }

  return "Resumen jurídico local: revisa los documentos disponibles y confirma el criterio en las fuentes oficiales aplicables antes de presentar escrito.";
}

// ─── Core Router functions ─────────────────────────────────────────────────────

export async function routeLlmCompletion(
  prompt: string,
  operation: string,
  requestIdOrOptions: string | { signal?: AbortSignal } = Math.random().toString(36).substring(7),
  extraParams?: { mode?: string; route?: string }
): Promise<{
  answer: string;
  provider: string;
  model: string;
  usedFallback: boolean;
  attemptedProviders: string[];
  failedProviders: { provider: string; reason: string }[];
  degraded: boolean;
}> {
  const requestId = typeof requestIdOrOptions === "string"
    ? requestIdOrOptions
    : Math.random().toString(36).substring(7);
  const externalSignal = typeof requestIdOrOptions === "object" ? requestIdOrOptions.signal : undefined;
  let chain = getProviderChain();
  let strategy = "chain";
  const mode = extraParams?.mode || operation;
  const route = extraParams?.route;

  if (process.env.AI_SELECTION_STRATEGY === "least-used") {
    try {
      const { selectLeastUsedProvider } = await import("./providerSelector");
      const selection = await selectLeastUsedProvider(mode, route || null);
      let selected = selection.provider;
      strategy = selection.strategy;

      if (selected === "local") {
        const keyedProvider = ["gemini", "groq", "openrouter"].find((provider) => {
          if (provider === "local") return false;
          return !!process.env[`${provider.toUpperCase()}_API_KEY`]?.trim();
        });
        selected = keyedProvider || selected;
      }
      
      // Put the selected provider at the beginning of the chain
      chain = [selected, ...chain.filter((p) => p !== selected)];
    } catch (err) {
      console.error("[routeLlmCompletion] Error choosing least used provider, fallback to chain:", err);
    }
  }

  const attemptedProviders: string[] = [];
  const failedProviders: { provider: string; reason: string }[] = [];
  let usedFallback = false;
  let degraded = false;
  const configuredProvider = chain[0] || "gemini";

  const globalStartTime = Date.now();
  const globalTimeoutMs = process.env.AI_GLOBAL_TIMEOUT_MS ? Number(process.env.AI_GLOBAL_TIMEOUT_MS) : 20000;

  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];

    // Global timeout check
    const timeElapsed = Date.now() - globalStartTime;
    if (timeElapsed >= globalTimeoutMs && current !== "local") {
      failedProviders.push({ provider: current, reason: "timeout" });
      degraded = true;
      continue;
    }

    attemptedProviders.push(current);

    if (current !== configuredProvider && current !== "local") {
      usedFallback = true;
    }

    const startTime = Date.now();

    if (current === "local") {
      const duration = Date.now() - startTime;
      const answer = getLocalFallbackText(prompt, operation);

      await persistLog({
        provider: "local",
        model: "local-static",
        operation,
        status: "success",
        reasonCategory: null,
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: Math.ceil(answer.length / 4),
        totalTokens: Math.ceil(prompt.length / 4) + Math.ceil(answer.length / 4),
        estimatedCostUsd: 0.0,
        costSource: "unavailable",
        durationMs: duration,
        fallbackUsed: i > 0,
        requestId,
        mode,
        route,
        strategy,
        fallbackRank: i,
      });

      return {
        answer,
        provider: "local",
        model: "local-static",
        usedFallback: i > 0,
        attemptedProviders,
        failedProviders,
        degraded: true,
      };
    }

    const key = process.env[`${current.toUpperCase()}_API_KEY`]?.trim();
    if (!key) {
      const duration = Date.now() - startTime;
      failedProviders.push({ provider: current, reason: "missing_api_key" });
      await persistLog({
        provider: current,
        model: null,
        operation,
        status: "failed",
        reasonCategory: "missing_api_key",
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        costSource: "unavailable",
        durationMs: duration,
        fallbackUsed: i > 0,
        requestId,
        mode,
        route,
        strategy,
        fallbackRank: i,
      });
      degraded = true;
      continue;
    }

    const timeoutMs = getProviderTimeoutMs(current);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    if (externalSignal?.aborted) {
      controller.abort();
    }
    const abortFromCaller = () => controller.abort();
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      let response: Response;
      let url = "";
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      let body = {};
      let model = "";

      if (current === "gemini") {
        model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
        url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
        body = {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        };
      } else if (current === "groq") {
        model = process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";
        url = "https://api.groq.com/openai/v1/chat/completions";
        headers["Authorization"] = `Bearer ${key}`;
        const isJson = operation === "consultant_report" || operation === "query_expansion" || prompt.toLowerCase().includes("json");
        body = {
          model,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
          ...(isJson ? { response_format: { type: "json_object" } } : {})
        };
      } else if (current === "openrouter") {
        model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-oss-20b:free";
        url = "https://openrouter.ai/api/v1/chat/completions";
        headers["Authorization"] = `Bearer ${key}`;
        headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        headers["X-Title"] = "juridico-radar";
        const isJson = operation === "consultant_report" || operation === "query_expansion" || prompt.toLowerCase().includes("json");
        body = {
          model,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
          ...(isJson ? { response_format: { type: "json_object" } } : {})
        };
      }

      response = await fetch(url, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      const resBodyText = await response.text();

      if (!response.ok) {
        const category = classifyResponse(response.status, resBodyText);
        failedProviders.push({ provider: current, reason: category });

        const rateLimitInfo = parseRateLimitHeaders(response.headers, current);

        await persistLog({
          provider: current,
          model,
          operation,
          status: "failed",
          reasonCategory: category,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          estimatedCostUsd: null,
          costSource: "unavailable",
          durationMs: duration,
          fallbackUsed: i > 0,
          requestId,
          mode,
          route,
          strategy,
          fallbackRank: i,
          ...rateLimitInfo
        });
        degraded = true;
        continue;
      }

      const data = JSON.parse(resBodyText);
      let answer = "";
      if (current === "gemini") {
        answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        answer = data.choices?.[0]?.message?.content || "";
      }

      if (!answer) {
        failedProviders.push({ provider: current, reason: "empty_response" });
        await persistLog({
          provider: current,
          model,
          operation,
          status: "failed",
          reasonCategory: "provider_error",
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          estimatedCostUsd: null,
          costSource: "unavailable",
          durationMs: duration,
          fallbackUsed: i > 0,
          requestId,
          mode,
          route,
          strategy,
          fallbackRank: i,
        });
        degraded = true;
        continue;
      }

      const usage = parseTokenUsage(data);
      const pTokens = usage.promptTokens ?? Math.ceil(prompt.length / 4);
      const cTokens = usage.completionTokens ?? Math.ceil(answer.length / 4);
      const tTokens = usage.totalTokens ?? (pTokens + cTokens);

      const costCalc = calculateEstimatedCost(current, model, pTokens, cTokens);
      const rateLimitInfo = parseRateLimitHeaders(response.headers, current);

      await persistLog({
        provider: current,
        model,
        operation,
        status: "success",
        reasonCategory: null,
        promptTokens: pTokens,
        completionTokens: cTokens,
        totalTokens: tTokens,
        estimatedCostUsd: costCalc.cost,
        costSource: costCalc.source,
        durationMs: duration,
        fallbackUsed: current !== configuredProvider,
        requestId,
        mode,
        route,
        strategy,
        fallbackRank: i,
        ...rateLimitInfo
      });

      return {
        answer,
        provider: current,
        model,
        usedFallback: current !== configuredProvider,
        attemptedProviders,
        failedProviders,
        degraded,
      };

    } catch (err: any) {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", abortFromCaller);
      const duration = Date.now() - startTime;
      const category = classifyError(err);

      failedProviders.push({ provider: current, reason: category });

      await persistLog({
        provider: current,
        model: current === "gemini" ? (process.env.GEMINI_MODEL || "gemini-2.5-flash") : current === "groq" ? (process.env.GROQ_MODEL || "llama-3.1-8b-instant") : (process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free"),
        operation,
        status: "failed",
        reasonCategory: category,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        costSource: "unavailable",
        durationMs: duration,
        fallbackUsed: i > 0,
        requestId,
        mode,
        route,
        strategy,
        fallbackRank: i,
      });
      degraded = true;
      continue;
    } finally {
      externalSignal?.removeEventListener("abort", abortFromCaller);
    }
  }

  // If we exhaust the chain (and local wasn't hit for some reason)
  const duration = Date.now() - globalStartTime;
  const fallbackAnswer = getLocalFallbackText(prompt, operation);
  await persistLog({
    provider: "local",
    model: "local-static-exhausted",
    operation,
    status: "success",
    reasonCategory: null,
    promptTokens: Math.ceil(prompt.length / 4),
    completionTokens: Math.ceil(fallbackAnswer.length / 4),
    totalTokens: Math.ceil(prompt.length / 4) + Math.ceil(fallbackAnswer.length / 4),
    estimatedCostUsd: 0.0,
    costSource: "unavailable",
    durationMs: duration,
    fallbackUsed: true,
    requestId,
    mode,
    route,
    strategy,
    fallbackRank: chain.length,
  });

  return {
    answer: fallbackAnswer,
    provider: "local",
    model: "local-static-exhausted",
    usedFallback: true,
    attemptedProviders,
    failedProviders,
    degraded: true,
  };
}

export async function routeStructuredAnalysis(
  input: LegalAiInput,
  operation: string,
  requestId: string = Math.random().toString(36).substring(7)
): Promise<{
  analysis: LegalAiAnalysis;
  provider: string;
  model: string;
  usedFallback: boolean;
  attemptedProviders: string[];
  failedProviders: { provider: string; reason: string }[];
  degraded: boolean;
}> {
  const prompt = buildLegalAiPrompt(input);

  const chain = getProviderChain();
  const attemptedProviders: string[] = [];
  const failedProviders: { provider: string; reason: string }[] = [];
  let degraded = false;
  const configuredProvider = (process.env.LLM_PROVIDER || "gemini").toLowerCase().trim();

  const globalStartTime = Date.now();
  const globalTimeoutMs = process.env.AI_GLOBAL_TIMEOUT_MS ? Number(process.env.AI_GLOBAL_TIMEOUT_MS) : 20000;

  for (let i = 0; i < chain.length; i++) {
    const current = chain[i];

    const timeElapsed = Date.now() - globalStartTime;
    if (timeElapsed >= globalTimeoutMs && current !== "local") {
      failedProviders.push({ provider: current, reason: "timeout" });
      degraded = true;
      continue;
    }

    attemptedProviders.push(current);

    const startTime = Date.now();

    if (current === "local") {
      const duration = Date.now() - startTime;
      const analysis = await analyzeWithLocalRules(input);

      await persistLog({
        provider: "local",
        model: "local-rules",
        operation,
        status: "success",
        reasonCategory: null,
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: 250,
        totalTokens: Math.ceil(prompt.length / 4) + 250,
        estimatedCostUsd: 0.0,
        costSource: "unavailable",
        durationMs: duration,
        fallbackUsed: true,
        requestId,
      });

      return {
        analysis,
        provider: "local",
        model: "local-rules",
        usedFallback: true,
        attemptedProviders,
        failedProviders,
        degraded: true,
      };
    }

    const key = process.env[`${current.toUpperCase()}_API_KEY`]?.trim();
    if (!key) {
      const duration = Date.now() - startTime;
      failedProviders.push({ provider: current, reason: "missing_api_key" });
      await persistLog({
        provider: current,
        model: null,
        operation,
        status: "failed",
        reasonCategory: "missing_api_key",
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        costSource: "unavailable",
        durationMs: duration,
        fallbackUsed: true,
        requestId,
      });
      degraded = true;
      continue;
    }

    const timeoutMs = getProviderTimeoutMs(current);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let response: Response;
      let url = "";
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      let body = {};
      let model = "";

      if (current === "gemini") {
        model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
        url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
        body = {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          }
        };
      } else if (current === "groq") {
        model = process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";
        url = "https://api.groq.com/openai/v1/chat/completions";
        headers["Authorization"] = `Bearer ${key}`;
        body = {
          model,
          temperature: 0.1,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        };
      } else if (current === "openrouter") {
        model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-oss-20b:free";
        url = "https://openrouter.ai/api/v1/chat/completions";
        headers["Authorization"] = `Bearer ${key}`;
        headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        headers["X-Title"] = "juridico-radar";
        body = {
          model,
          temperature: 0.1,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" }
        };
      }

      response = await fetch(url, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      const resBodyText = await response.text();

      if (!response.ok) {
        const category = classifyResponse(response.status, resBodyText);
        failedProviders.push({ provider: current, reason: category });

        const rateLimitInfo = parseRateLimitHeaders(response.headers, current);

        await persistLog({
          provider: current,
          model,
          operation,
          status: "failed",
          reasonCategory: category,
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          estimatedCostUsd: null,
          costSource: "unavailable",
          durationMs: duration,
          fallbackUsed: true,
          requestId,
          ...rateLimitInfo
        });
        degraded = true;
        continue;
      }

      const data = JSON.parse(resBodyText);
      let answer = "";
      if (current === "gemini") {
        answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } else {
        answer = data.choices?.[0]?.message?.content || "";
      }

      if (!answer) {
        failedProviders.push({ provider: current, reason: "empty_response" });
        await persistLog({
          provider: current,
          model,
          operation,
          status: "failed",
          reasonCategory: "provider_error",
          promptTokens: null,
          completionTokens: null,
          totalTokens: null,
          estimatedCostUsd: null,
          costSource: "unavailable",
          durationMs: duration,
          fallbackUsed: true,
          requestId,
        });
        degraded = true;
        continue;
      }

      const parsedAnalysis = sanitizeLegalAiAnalysis(extractJsonObject(answer), input);

      const usage = parseTokenUsage(data);
      const pTokens = usage.promptTokens ?? Math.ceil(prompt.length / 4);
      const cTokens = usage.completionTokens ?? Math.ceil(answer.length / 4);
      const tTokens = usage.totalTokens ?? (pTokens + cTokens);

      const costCalc = calculateEstimatedCost(current, model, pTokens, cTokens);
      const rateLimitInfo = parseRateLimitHeaders(response.headers, current);

      await persistLog({
        provider: current,
        model,
        operation,
        status: "success",
        reasonCategory: null,
        promptTokens: pTokens,
        completionTokens: cTokens,
        totalTokens: tTokens,
        estimatedCostUsd: costCalc.cost,
        costSource: costCalc.source,
        durationMs: duration,
        fallbackUsed: current !== configuredProvider,
        requestId,
        ...rateLimitInfo
      });

      return {
        analysis: parsedAnalysis,
        provider: current,
        model,
        usedFallback: current !== configuredProvider,
        attemptedProviders,
        failedProviders,
        degraded,
      };

    } catch (err: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      const category = classifyError(err);

      failedProviders.push({ provider: current, reason: category });

      await persistLog({
        provider: current,
        model: current === "gemini" ? (process.env.GEMINI_MODEL || "gemini-2.5-flash") : current === "groq" ? (process.env.GROQ_MODEL || "llama-3.1-8b-instant") : (process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free"),
        operation,
        status: "failed",
        reasonCategory: category,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        estimatedCostUsd: null,
        costSource: "unavailable",
        durationMs: duration,
        fallbackUsed: true,
        requestId,
      });
      degraded = true;
      continue;
    }
  }

  // Exhausted chain -> local rules
  const duration = Date.now() - globalStartTime;
  const analysis = await analyzeWithLocalRules(input);
  await persistLog({
    provider: "local",
    model: "local-rules-exhausted",
    operation,
    status: "success",
    reasonCategory: null,
    promptTokens: Math.ceil(prompt.length / 4),
    completionTokens: 250,
    totalTokens: Math.ceil(prompt.length / 4) + 250,
    estimatedCostUsd: 0.0,
    costSource: "unavailable",
    durationMs: duration,
    fallbackUsed: true,
    requestId,
  });

  return {
    analysis,
    provider: "local",
    model: "local-rules-exhausted",
    usedFallback: true,
    attemptedProviders,
    failedProviders,
    degraded: true,
  };
}

// ─── Keep Existing TASK methods ───────────────────────────────────────────────

export async function analyzeLegalText(input: AnalyzeLegalTextInput) {
  const result = await routeStructuredAnalysis(input, "impact_classification");
  return result.analysis;
}

export async function analyzeLegalImage(input: AnalyzeLegalImageInput) {
  return analyzeLegalImageWithProvider(input);
}

export async function searchRecentContext(input: RecentContextInput) {
  return searchRecentContextWithProvider(input);
}

export async function matchAlertRule(input: AlertMatchInput) {
  const aiAnalysis =
    input.aiAnalysis ||
    (await analyzeLegalText({
      title: input.documentTitle,
      summary: input.documentSummary,
    }));

  return matchAlertRuleLocally({ ...input, aiAnalysis });
}

export async function generateWeeklyDigest(input: {
  documents: WeeklyDigestDocument[];
  periodStart: Date | string;
  periodEnd: Date | string;
}) {
  return generateWeeklyDigestLocally(input);
}
