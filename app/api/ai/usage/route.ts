import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // 1. Protect with requireAdmin
    const adminCheck = requireAdmin(req);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const { searchParams } = new URL(req.url);
    const paramDate = searchParams.get("date");
    const paramStart = searchParams.get("startDate");
    const paramEnd = searchParams.get("endDate");

    let startRange: Date;
    let endRange: Date;
    let rangeLabel = "";

    if (paramStart && paramEnd) {
      startRange = new Date(`${paramStart}T00:00:00.000Z`);
      endRange = new Date(`${paramEnd}T23:59:59.999Z`);
      rangeLabel = `${paramStart} a ${paramEnd}`;
    } else {
      const targetDateStr = paramDate || new Date().toISOString().split("T")[0];
      startRange = new Date(`${targetDateStr}T00:00:00.000Z`);
      endRange = new Date(`${targetDateStr}T23:59:59.999Z`);
      rangeLabel = targetDateStr;
    }

    // 2. Fetch logs from database
    const logs = await prisma.aiUsageLog.findMany({
      where: {
        createdAt: {
          gte: startRange,
          lte: endRange,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // 3. Define provider registry
    const providerNames = ["gemini", "groq", "openrouter", "local"];
    const providerStats: Record<string, any> = {};

    providerNames.forEach((prov) => {
      let configured = false;
      if (prov === "gemini") configured = !!process.env.GEMINI_API_KEY?.trim();
      else if (prov === "groq") configured = !!process.env.GROQ_API_KEY?.trim();
      else if (prov === "openrouter") configured = !!process.env.OPENROUTER_API_KEY?.trim();
      else if (prov === "local") configured = true;

      providerStats[prov] = {
        provider: prov,
        configured,
        attempts: 0,
        successes: 0,
        failures: 0,
        fallbacks: 0,
        rateLimited: 0,
        quotaExceeded: 0,
        timeouts: 0,
        missingKey: 0,
        invalidKey: 0,
        estimatedTokens: 0,
        estimatedCostUsd: 0,
        costSource: "unavailable",
        rateLimit: {
          source: "unavailable",
          limit: null,
          remaining: null,
          resetAt: null,
          note: prov === "groq"
            ? "Límites dinámicos consultados de las cabeceras HTTP de respuesta."
            : "Este proveedor no expone límites diarios consultables desde esta app.",
        },
      };
    });

    let totalAttempts = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    let totalFallbacks = 0;
    let totalTokens = 0;
    let totalCostUsd = 0;

    // 4. Process logs to populate stats
    logs.forEach((log) => {
      const prov = log.provider.toLowerCase().trim();
      
      // If we encounter a provider not in our default list, initialize it dynamically
      if (!providerStats[prov]) {
        providerStats[prov] = {
          provider: prov,
          configured: false,
          attempts: 0,
          successes: 0,
          failures: 0,
          fallbacks: 0,
          rateLimited: 0,
          quotaExceeded: 0,
          timeouts: 0,
          missingKey: 0,
          invalidKey: 0,
          estimatedTokens: 0,
          estimatedCostUsd: 0,
          costSource: "unavailable",
          rateLimit: {
            source: "unavailable",
            limit: null,
            remaining: null,
            resetAt: null,
            note: "Este proveedor no expone límites diarios consultables desde esta app.",
          },
        };
      }

      const stats = providerStats[prov];
      stats.attempts++;
      totalAttempts++;

      if (log.status === "success") {
        stats.successes++;
        totalSuccesses++;
      } else {
        stats.failures++;
        totalFailures++;

        if (log.reasonCategory === "rate_limited") stats.rateLimited++;
        else if (log.reasonCategory === "quota_exceeded") stats.quotaExceeded++;
        else if (log.reasonCategory === "timeout") stats.timeouts++;
        else if (log.reasonCategory === "missing_api_key") stats.missingKey++;
        else if (log.reasonCategory === "invalid_api_key") stats.invalidKey++;
      }

      if (log.fallbackUsed) {
        stats.fallbacks++;
        totalFallbacks++;
      }

      if (log.totalTokens) {
        stats.estimatedTokens += log.totalTokens;
        totalTokens += log.totalTokens;
      }

      if (log.estimatedCostUsd) {
        const costNum = Number(log.estimatedCostUsd);
        stats.estimatedCostUsd += costNum;
        totalCostUsd += costNum;
        stats.costSource = log.costSource || "estimated";
      }

      // Update rate limits from latest log details
      if (log.rateLimitSource && log.rateLimitSource !== "unavailable") {
        stats.rateLimit = {
          source: log.rateLimitSource,
          limit: log.rateLimitLimit,
          remaining: log.rateLimitRemaining,
          resetAt: log.rateLimitResetAt,
          note: `Límites consultados el ${new Date(log.createdAt).toLocaleTimeString("es-MX")}`,
        };
      }
    });

    // 5. Format Decimal fields nicely as strings
    const providersList = Object.values(providerStats).map((stats: any) => ({
      ...stats,
      estimatedCostUsd: stats.estimatedCostUsd.toFixed(6),
    }));

    return NextResponse.json({
      ok: true,
      date: rangeLabel,
      timezone: process.env.AI_USAGE_TIMEZONE || "America/Mexico_City",
      summary: {
        totalAttempts,
        totalSuccesses,
        totalFailures,
        totalFallbacks,
        estimatedTokens: totalTokens,
        estimatedCostUsd: totalCostUsd.toFixed(6),
      },
      providers: providersList,
      generatedAt: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("[ai/usage] GET error:", error);
    return NextResponse.json(
      { ok: false, error: "service_error", message: "No se pudieron obtener las métricas de consumo." },
      { status: 500 }
    );
  }
}
