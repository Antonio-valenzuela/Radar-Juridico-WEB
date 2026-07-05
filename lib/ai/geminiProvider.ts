import type { LegalAiAnalysis, LegalAiInput } from "./types";
import {
  buildLegalAiPrompt,
  extractJsonObject,
  getAiTimeoutMs,
  sanitizeLegalAiAnalysis,
} from "./types";
import { analyzeWithLocalRules } from "./localRulesProvider";

export async function analyzeWithGemini(input: LegalAiInput): Promise<LegalAiAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return analyzeWithLocalRules(input);

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getAiTimeoutMs());

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: buildLegalAiPrompt(input) }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned empty content");

    return sanitizeLegalAiAnalysis(extractJsonObject(text), input);
  } catch {
    return analyzeWithLocalRules(input);
  } finally {
    clearTimeout(timeout);
  }
}

export const geminiProvider = {
  analyzeLegalDocument: analyzeWithGemini,
};
