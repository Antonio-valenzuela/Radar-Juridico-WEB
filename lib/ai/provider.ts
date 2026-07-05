import type { LegalAiAnalysis, LegalAiInput, LegalAiProviderName } from "./types";
import { routeStructuredAnalysis } from "./router";
import { withMetrics } from '../observability/metrics';
import { logError } from '../observability/logger';

export function getConfiguredLegalAiProviderName(): LegalAiProviderName {
  const provider = (process.env.LLM_PROVIDER || "local").toLowerCase().trim();

  if (provider === "gemini") return "gemini";
  if (provider === "openrouter") return "openrouter";
  if (provider === "groq") return "groq";

  return "local";
}

export function getActiveLegalAiProviderName(): LegalAiProviderName {
  const configured = getConfiguredLegalAiProviderName();

  if (configured === "gemini" && process.env.GEMINI_API_KEY?.trim()) return "gemini";
  if (configured === "openrouter" && process.env.OPENROUTER_API_KEY?.trim()) return "openrouter";
  if (configured === "groq" && process.env.GROQ_API_KEY?.trim()) return "groq";

  return "local";
}

export async function analyzeLegalDocument(input: LegalAiInput): Promise<LegalAiAnalysis> {
  return withMetrics('ai_analyze', async () => {
    try {
      const result = await routeStructuredAnalysis(input, "impact_classification");
      return result.analysis;
    } catch (error) {
      logError('ai_provider_error', error, { provider: "router" });
      const { analyzeWithLocalRules } = await import("./localRulesProvider");
      return await analyzeWithLocalRules(input);
    }
  }, { provider: "router", titleLength: input.title.length });
}

export async function analyzeLegalDocumentWithProvider(input: LegalAiInput): Promise<{
  provider: LegalAiProviderName;
  analysis: LegalAiAnalysis;
}> {
  const result = await routeStructuredAnalysis(input, "impact_classification");
  return {
    provider: result.provider as any,
    analysis: result.analysis,
  };
}
