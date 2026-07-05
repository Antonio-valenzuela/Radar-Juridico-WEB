import type { LegalAiAnalysis, LegalAiInput } from "./types";
import {
  buildLegalAiPrompt,
  extractJsonObject,
  getAiTimeoutMs,
  sanitizeLegalAiAnalysis,
} from "./types";
import { analyzeWithLocalRules } from "./localRulesProvider";

export async function analyzeWithGroq(input: LegalAiInput): Promise<LegalAiAnalysis> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return analyzeWithLocalRules(input);

  const model = process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getAiTimeoutMs());

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
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
      throw new Error(`Groq request failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("Groq returned empty content");

    return sanitizeLegalAiAnalysis(extractJsonObject(text), input);
  } catch {
    return analyzeWithLocalRules(input);
  } finally {
    clearTimeout(timeout);
  }
}

export const groqProvider = {
  analyzeLegalDocument: analyzeWithGroq,
};
