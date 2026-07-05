import { routeLlmCompletion } from "./ai/router";
import { getTimeoutMs } from "./config/timeouts";

export async function generateLlmCompletion(
  prompt: string,
  operation: string = "llm_completion"
): Promise<{
  answer: string;
  provider: "gemini" | "groq" | "openrouter" | "local";
  model: string;
  usedFallback: boolean;
}> {
  // Determine operation based on prompt hints if it's generic
  let inferredOp = operation;
  if (operation === "llm_completion") {
    if (prompt.includes("alternativeTerms") || prompt.includes("officialSources")) {
      inferredOp = "query_expansion";
    } else if (prompt.includes("legalImpact") || prompt.includes("attentionPoints")) {
      inferredOp = "rag_answer";
    }
  }

  // Usar timeout abortable para evitar cargas infinitas
  const controller = new AbortController();
  const timeoutMs = getTimeoutMs("AI_ANALYSIS_TIMEOUT_MS", 30000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await routeLlmCompletion(prompt, inferredOp, { signal: controller.signal });
    clearTimeout(timeoutId);
    return {
      answer: result.answer,
      provider: result.provider as any,
      model: result.model,
      usedFallback: result.usedFallback,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}
