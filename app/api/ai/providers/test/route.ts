import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { GroqProvider } from "@/lib/ai/providers/groq";
import { OpenRouterProvider } from "@/lib/ai/providers/openrouter";
import { LocalProvider } from "@/lib/ai/providers/local";

export const dynamic = "force-dynamic";

async function handleProviderTest(req: NextRequest) {
  const adminCheck = requireAdmin(req);
  if (!adminCheck.ok) return adminCheck.response;

  const hasGeminiKey = !!process.env.GEMINI_API_KEY?.trim();
  const hasGroqKey = !!process.env.GROQ_API_KEY?.trim();
  const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY?.trim();
  const hasAnyApiKey = hasGeminiKey || hasGroqKey || hasOpenRouterKey;

  const gemini = new GeminiProvider();
  const groq = new GroqProvider();
  const openrouter = new OpenRouterProvider();
  const local = new LocalProvider();

  const testMessage = "Responde únicamente la palabra OK";

  const [geminiRes, groqRes, openrouterRes, localRes] = await Promise.all([
    gemini.isAvailable().then(async (avail) => (avail ? gemini.generate({ userMessage: testMessage, maxTokens: 10 }) : null)),
    groq.isAvailable().then(async (avail) => (avail ? groq.generate({ userMessage: testMessage, maxTokens: 10 }) : null)),
    openrouter.isAvailable().then(async (avail) => (avail ? openrouter.generate({ userMessage: testMessage, maxTokens: 10 }) : null)),
    local.generate({ userMessage: testMessage }),
  ]);

  if (!hasAnyApiKey) {
    console.warn(
      "[AI Router] Fallback a 'local': ninguna API key configurada (GEMINI_API_KEY/GROQ_API_KEY/OPENROUTER_API_KEY)"
    );
  }

  return NextResponse.json({
    ok: true,
    testedAt: new Date().toISOString(),
    hasAnyApiKey,
    usedFallbackNoKeys: !hasAnyApiKey,
    warning: !hasAnyApiKey
      ? "[AI Router] Fallback a 'local': ninguna API key configurada (GEMINI_API_KEY/GROQ_API_KEY/OPENROUTER_API_KEY)"
      : null,
    results: {
      gemini: geminiRes ? { success: geminiRes.success, model: geminiRes.model, latencyMs: geminiRes.latencyMs, error: geminiRes.errorCode } : { success: false, error: "NOT_CONFIGURED" },
      groq: groqRes ? { success: groqRes.success, model: groqRes.model, latencyMs: groqRes.latencyMs, error: groqRes.errorCode } : { success: false, error: "NOT_CONFIGURED" },
      openrouter: openrouterRes ? { success: openrouterRes.success, model: openrouterRes.model, latencyMs: openrouterRes.latencyMs, error: openrouterRes.errorCode } : { success: false, error: "NOT_CONFIGURED" },
      local: { success: localRes.success, model: localRes.model, latencyMs: localRes.latencyMs },
    },
  });
}

export async function POST(req: NextRequest) {
  return handleProviderTest(req);
}

export async function GET(req: NextRequest) {
  return handleProviderTest(req);
}
