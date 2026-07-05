export type AiMode = "empty_search_assistant" | "rag" | "classification" | "summary" | "general";

export const providerCapabilities: Record<AiMode, string[]> = {
  empty_search_assistant: ["groq", "openrouter", "gemini", "local"],
  rag: ["gemini", "openrouter", "groq", "local"],
  classification: ["groq", "gemini", "openrouter", "local"],
  summary: ["gemini", "openrouter", "groq", "local"],
  general: ["groq", "openrouter", "gemini", "local"],
};

export function getAllowedProvidersForMode(mode: string): string[] {
  const normalizedMode = (mode || "general").toLowerCase() as AiMode;
  if (normalizedMode in providerCapabilities) {
    return providerCapabilities[normalizedMode];
  }
  return providerCapabilities.general;
}
