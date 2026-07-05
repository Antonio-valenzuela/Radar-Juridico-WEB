import type { ConsultantInputChange, ConsultantReport } from "@/lib/consultant/types";

type LlmInput = {
  title: string;
  source: string;
  published: string;
  tipo: string | null;
  tema: string | null;
  impacto: string | null;
  summary: string | null;
  diffBullets: string[];
  changedArticles: ConsultantInputChange[];
};

const PROMPT_VERSION = "consultor-legal-v1";

export function consultantPromptVersion() {
  return PROMPT_VERSION;
}

import { routeLlmCompletion } from "../ai/router";

export async function maybeGenerateLlmReport(input: LlmInput): Promise<ConsultantReport | null> {
  const prompt = [
    "Eres un consultor legal-tech para abogados mexicanos. Solo analizas textos publicos. No das asesoria legal definitiva. Responde JSON valido con: executiveSummary, keyChanges, affectedParties, actionItems, riskFlags, followUpQuestions, confidence.",
    JSON.stringify({
      instruction: "Resume como consultor que debe detectar que cambio, a quien afecta y que revisar. Maximo 5 elementos por lista. No inventes articulos no incluidos.",
      item: input,
    }),
  ].join("\n");

  try {
    const result = await routeLlmCompletion(prompt, "consultant_report");
    let cleanAnswer = result.answer.trim();
    if (cleanAnswer.startsWith("```")) {
      cleanAnswer = cleanAnswer.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
    }
    const json = JSON.parse(cleanAnswer);
    return toReport(json, result.provider, result.model);
  } catch (err) {
    console.error("[consultant] maybeGenerateLlmReport failed:", err);
    return null;
  }
}

function toReport(json: Partial<ConsultantReport> | null, provider: string, model: string): ConsultantReport | null {
  if (!json?.executiveSummary) return null;

  return {
    executiveSummary: clean(json.executiveSummary, 900),
    keyChanges: cleanList(json.keyChanges),
    affectedParties: cleanList(json.affectedParties),
    actionItems: cleanList(json.actionItems),
    riskFlags: cleanList(json.riskFlags),
    followUpQuestions: cleanList(json.followUpQuestions),
    confidence: json.confidence === "alta" || json.confidence === "media" || json.confidence === "baja"
      ? json.confidence
      : "media",
    provider,
    model,
    promptVersion: PROMPT_VERSION,
  };
}

function cleanList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => clean(String(item), 280)).filter(Boolean).slice(0, 5)
    : [];
}

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
