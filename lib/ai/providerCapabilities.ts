export type AiMode = "empty_search_assistant" | "rag" | "classification" | "summary" | "general";

export const providerCapabilities: Record<AiMode, string[]> = {
  empty_search_assistant: ["nvidia", "gemini", "groq", "openrouter", "local"],
  rag: ["nvidia", "gemini", "openrouter", "groq", "local"],
  classification: ["nvidia", "groq", "gemini", "openrouter", "local"],
  summary: ["nvidia", "gemini", "openrouter", "groq", "local"],
  general: ["nvidia", "gemini", "groq", "openrouter", "local"],
};

export function getAllowedProvidersForMode(mode: string): string[] {
  const normalizedMode = (mode || "general").toLowerCase() as AiMode;
  if (normalizedMode in providerCapabilities) {
    return providerCapabilities[normalizedMode];
  }
  return providerCapabilities.general;
}
