import type { AIHealthResult, AIProvider, AIProviderResult, AIRequest } from "./types";
import { sanitizeAiError } from "./types";

export class GroqProvider implements AIProvider {
  readonly id = "groq" as const;

  private getApiKey(): string | null {
    return process.env.GROQ_API_KEY?.trim() || null;
  }

  private getModel(): string {
    return process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant";
  }

  async isAvailable(): Promise<boolean> {
    return !!this.getApiKey();
  }

  async generate(request: AIRequest): Promise<AIProviderResult> {
    const startTime = Date.now();
    const apiKey = this.getApiKey();
    const model = this.getModel();

    if (!apiKey) {
      return {
        provider: this.id,
        model,
        success: false,
        content: "",
        latencyMs: 0,
        errorCode: "NOT_CONFIGURED",
        retryable: false,
        warnings: ["GROQ_API_KEY no está configurada en las variables de entorno."],
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

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
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
        throw new Error(`Groq API respondió con estado ${response.status}`);
      }

      const data = (await response.json()) as any;
      const text = data.choices?.[0]?.message?.content?.trim() || "";

      if (!text) {
        throw new Error("Groq devolvió una respuesta vacía");
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
        lastError: "GROQ_API_KEY no configurada",
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

export const groqProviderInstance = new GroqProvider();
