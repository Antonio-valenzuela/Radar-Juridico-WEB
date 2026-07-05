import type { AnalyzeLegalImageInput, AnalyzeLegalImageResult } from "./tasks";

export async function analyzeLegalImage(input: AnalyzeLegalImageInput): Promise<AnalyzeLegalImageResult> {
  void input;

  return {
    ok: false,
    reason: process.env.AI_ENABLE_VISION === "true" ? "not_implemented" : "vision_not_configured",
    provider: process.env.VISION_PROVIDER || "none",
  };
}
