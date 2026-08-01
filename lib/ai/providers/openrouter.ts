import type { AIHealthResult, AIProvider, AIProviderResult, AIRequest } from "./types";
import { sanitizeAiError } from "./types";

export class OpenRouterProvider implements AIProvider {
  id: "openrouter" = "openrouter";

  private getApiKey(): string | null {
    return process.env.OPENROUTER_API_KEY?.trim() || null;
  }

  private getModel(isJudge = false): string {
    if (isJudge) {
      return (
        process.env.OPENROUTER_JUDGE_MODEL?.trim() ||
        process.env.OPENROUTER_MODEL?.trim() ||
        "openai/gpt-oss-20b:free"
      );
    }
    return process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-oss-20b:free";
  }

  async isAvailable(): Promise<boolean> {
    return !!this.getApiKey();
  }

  async generate(request: AIRequest, isJudgeMode = false): Promise<AIProviderResult> {
    const startTime = Date.now();
    const apiKey = this.getApiKey();
    const model = this.getModel(isJudgeMode);

    if (!apiKey) {
      return {
        provider: this.id,
        model,
        success: false,
        content: "",
        latencyMs: 0,
        errorCode: "NOT_CONFIGURED",
        retryable: false,
        warnings: ["OPENROUTER_API_KEY no está configurada en las variables de entorno."],
      };
    }

    const timeoutMs = request.mode === "deep"
      ? (Number(process.env.AI_DEEP_TIMEOUT_MS) || 60000)
      : (Number(process.env.AI_FAST_TIMEOUT_MS) || 20000);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const messages = [
        {
          role: "system",
          content: request.systemPrompt || "Eres un asistente legal experto en derecho mexicano.",
        },
        {
          role: "user",
          content: request.userMessage,
        },
      ];

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
          temperature: request.temperature ?? 0.1,
          max_tokens: request.maxTokens ?? 2048,
          messages,
        }),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`OpenRouter API respondió con estado ${response.status}`);
      }

      const data = (await response.json()) as any;
      const text = data.choices?.[0]?.message?.content?.trim() || "";

      if (!text) {
        throw new Error("OpenRouter devolvió una respuesta vacía");
      }

      return {
        provider: this.id,
        model,
        success: true,
        content: text,
        latencyMs,
        usage: {
          promptTokens: data.usage?.prompt_tokens || null,
          completionTokens: data.usage?.completion_tokens || null,
          totalTokens: data.usage?.total_tokens || null,
        },
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = sanitizeAiError(err);
      return {
        provider: this.id,
        model,
        success: false,
        content: "",
        latencyMs,
        errorCode: errorMsg,
        retryable: true,
        warnings: [errorMsg],
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async healthCheck(): Promise<AIHealthResult> {
    const apiKey = this.getApiKey();
    const model = this.getModel();
    const lastCheckAt = new Date().toISOString();

    if (!apiKey) {
      return {
        provider: this.id,
        configured: false,
        available: false,
        model,
        lastCheckAt,
        lastError: "OPENROUTER_API_KEY no configurada",
      };
    }

    try {
      const res = await this.generate({
        userMessage: "Responde únicamente con la palabra 'OK'",
        maxTokens: 5,
      });

      return {
        provider: this.id,
        configured: true,
        available: res.success,
        model,
        lastCheckAt,
        latencyMs: res.latencyMs,
        lastError: res.success ? null : res.errorCode,
      };
    } catch (err) {
      return {
        provider: this.id,
        configured: true,
        available: false,
        model,
        lastCheckAt,
        lastError: sanitizeAiError(err),
      };
    }
  }
}

export const openRouterProviderInstance = new OpenRouterProvider();
