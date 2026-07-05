import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Protect with requireAdmin
  const adminCheck = requireAdmin(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const dailyLimit = process.env.AI_LOCAL_DAILY_LIMIT ? Number(process.env.AI_LOCAL_DAILY_LIMIT) : 20;

  // Get start and end of today in UTC
  const todayStr = new Date().toISOString().split("T")[0];
  const startRange = new Date(`${todayStr}T00:00:00.000Z`);
  const endRange = new Date(`${todayStr}T23:59:59.999Z`);

  // Query database logs for today
  let geminiAttempts = 0;
  let groqAttempts = 0;
  let openRouterAttempts = 0;
  let openRouterCost = 0;

  try {
    const logs = await prisma.aiUsageLog.findMany({
      where: {
        createdAt: {
          gte: startRange,
          lte: endRange,
        },
      },
    });

    logs.forEach((log) => {
      const prov = log.provider.toLowerCase().trim();
      if (prov === "gemini") geminiAttempts++;
      else if (prov === "groq") groqAttempts++;
      else if (prov === "openrouter") {
        openRouterAttempts++;
        if (log.estimatedCostUsd) {
          openRouterCost += Number(log.estimatedCostUsd);
        }
      }
    });
  } catch (err) {
    console.error("[limits] Error querying DB logs:", err);
  }

  const limits = {
    gemini: {
      provider: "Gemini (Google AI)",
      remaining: `Límite local configurado: ${dailyLimit} intentos. Llevas ${geminiAttempts} consumidos (Quedan ${Math.max(0, dailyLimit - geminiAttempts)} intentos).`,
    },
    groq: {
      provider: "Groq",
      remaining: `Límites consultables vía headers. Consumo registrado hoy por esta app: ${groqAttempts} req.`,
    },
    openRouter: {
      provider: "OpenRouter",
      remaining: "API Key no configurada",
    },
  };

  // Add real header limits for Groq if we have them in the DB
  try {
    const lastGroqWithRateLimit = await prisma.aiUsageLog.findFirst({
      where: {
        provider: "groq",
        rateLimitSource: "provider_headers",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (lastGroqWithRateLimit && lastGroqWithRateLimit.rateLimitRemaining != null) {
      limits.groq.remaining = `Quedan ${lastGroqWithRateLimit.rateLimitRemaining} req de rate limit real (Límite: ${lastGroqWithRateLimit.rateLimitLimit}). Consumo hoy: ${groqAttempts} req.`;
    }
  } catch (_) {}

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${openRouterKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        const limit = data.data?.limit;
        const usage = data.data?.usage;
        if (limit != null && usage != null) {
          limits.openRouter.remaining = `Límite total de la llave: $${limit}. Consumido total: $${usage.toFixed(4)}. Consumo hoy (estimado): $${openRouterCost.toFixed(6)}.`;
        } else {
          limits.openRouter.remaining = `Consumo hoy (estimado por app): $${openRouterCost.toFixed(6)} (Free tier / No hard limit)`;
        }
      } else {
        limits.openRouter.remaining = `Consumo hoy (estimado por app): $${openRouterCost.toFixed(6)} (Error al consultar OpenRouter API)`;
      }
    } catch {
      limits.openRouter.remaining = `Consumo hoy (estimado por app): $${openRouterCost.toFixed(6)} (Error de conexión con OpenRouter)`;
    }
  }

  return NextResponse.json({
    ok: true,
    limits,
    summary: {
      totalAttempts: geminiAttempts + groqAttempts + openRouterAttempts,
      totalSuccesses: geminiAttempts + groqAttempts + openRouterAttempts,
      totalFailures: 0,
      totalFallbacks: 0,
      estimatedTokens: 0,
      estimatedCostUsd: openRouterCost.toFixed(6)
    },
    providers: []
  });
}
