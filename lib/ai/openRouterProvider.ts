import type { LegalAiAnalysis, LegalAiInput } from "./types";
import {
  buildLegalAiPrompt,
  extractJsonObject,
  getAiTimeoutMs,
  sanitizeLegalAiAnalysis,
} from "./types";
import { analyzeWithLocalRules } from "./localRulesProvider";

export async function analyzeWithOpenRouter(input: LegalAiInput): Promise<LegalAiAnalysis> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return analyzeWithLocalRules(input);

  const model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-oss-20b:free";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getAiTimeoutMs());

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "juridico-radar",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: buildLegalAiPrompt(input),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenRouter returned empty content");

    return sanitizeLegalAiAnalysis(extractJsonObject(text), input);
  } catch {
    return analyzeWithLocalRules(input);
  } finally {
    clearTimeout(timeout);
  }
}

export const openRouterProvider = {
  analyzeLegalDocument: analyzeWithOpenRouter,
};
