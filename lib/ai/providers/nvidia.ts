import { fetch } from "undici";
import type { AIHealthResult, AIProvider, AIProviderResult, AIRequest } from "./types";
import { sanitizeAiError } from "./types";

export interface NVIDIACompletionOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface NVIDIACompletionResult {
  text: string;
  model: string;
  tokensUsed?: number;
  rawResponse?: unknown;
}

export async function generateNVIDIACompletion(
  options: NVIDIACompletionOptions
): Promise<NVIDIACompletionResult> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const baseUrl = (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/+$/, "");
  const model = process.env.GLM_MODEL || "thudm/glm-4-9b-chat";

  if (!apiKey) {
    throw new Error("[NVIDIA Provider] NVIDIA_API_KEY no configurada.");
  }

  const messages = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: options.prompt });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2048,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[NVIDIA Provider] HTTP ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as any;
    const text = data?.choices?.[0]?.message?.content?.trim() || "";

    if (!text) {
      throw new Error("[NVIDIA Provider] Respuesta vacía del modelo de NVIDIA Build.");
    }

    return {
      text,
      model,
      tokensUsed: data?.usage?.total_tokens || 0,
      rawResponse: data,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("[NVIDIA Provider] Timeout de 30s alcanzado en la llamada a NVIDIA Build.");
    }
    throw error;
  }
}

export class NVIDIAProvider implements AIProvider {
  id = "nvidia" as const;

  async isAvailable(): Promise<boolean> {
    return !!process.env.NVIDIA_API_KEY?.trim();
  }

  async generate(request: AIRequest): Promise<AIProviderResult> {
    const startTime = Date.now();
    const model = process.env.GLM_MODEL || "thudm/glm-4-9b-chat";

    try {
      const res = await generateNVIDIACompletion({
        prompt: request.userMessage,
        systemPrompt: request.systemPrompt,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      });

      return {
        provider: "nvidia",
        model: res.model,
        success: true,
        content: res.text,
        latencyMs: Date.now() - startTime,
        usage: {
          promptTokens: null,
          completionTokens: null,
          totalTokens: res.tokensUsed || null,
        },
      };
    } catch (error: unknown) {
      return {
        provider: "nvidia",
        model,
        success: false,
        content: "",
        latencyMs: Date.now() - startTime,
        errorCode: "NVIDIA_ERROR",
        warnings: [sanitizeAiError(error)],
      };
    }
  }

  async healthCheck(): Promise<AIHealthResult> {
    const configured = await this.isAvailable();
    const model = process.env.GLM_MODEL || "thudm/glm-4-9b-chat";

    if (!configured) {
      return {
        provider: "nvidia",
        configured: false,
        available: false,
        model,
        lastCheckAt: new Date().toISOString(),
        lastError: "NVIDIA_API_KEY no configurada",
      };
    }

    const start = Date.now();
    try {
      await generateNVIDIACompletion({
        prompt: "ping",
        maxTokens: 5,
      });

      return {
        provider: "nvidia",
        configured: true,
        available: true,
        model,
        lastCheckAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
      };
    } catch (error: unknown) {
      return {
        provider: "nvidia",
        configured: true,
        available: false,
        model,
        lastCheckAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
        lastError: sanitizeAiError(error),
      };
    }
  }
}
