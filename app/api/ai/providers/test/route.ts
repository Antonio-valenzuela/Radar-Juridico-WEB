import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { GroqProvider } from "@/lib/ai/providers/groq";
import { OpenRouterProvider } from "@/lib/ai/providers/openrouter";
import { LocalProvider } from "@/lib/ai/providers/local";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminCheck = requireAdmin(req);
  if (!adminCheck.ok) return adminCheck.response;

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

  return NextResponse.json({
    ok: true,
    testedAt: new Date().toISOString(),
    results: {
      gemini: geminiRes ? { success: geminiRes.success, model: geminiRes.model, latencyMs: geminiRes.latencyMs, error: geminiRes.errorCode } : { success: false, error: "NOT_CONFIGURED" },
      groq: groqRes ? { success: groqRes.success, model: groqRes.model, latencyMs: groqRes.latencyMs, error: groqRes.errorCode } : { success: false, error: "NOT_CONFIGURED" },
      openrouter: openrouterRes ? { success: openrouterRes.success, model: openrouterRes.model, latencyMs: openrouterRes.latencyMs, error: openrouterRes.errorCode } : { success: false, error: "NOT_CONFIGURED" },
      local: { success: localRes.success, model: localRes.model, latencyMs: localRes.latencyMs },
    },
  });
}
