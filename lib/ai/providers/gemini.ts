import type { AIHealthResult, AIProvider, AIProviderResult, AIRequest } from "./types";
import { sanitizeAiError } from "./types";

export class GeminiProvider implements AIProvider {
  id: "gemini" = "gemini";

  private getApiKey(): string | null {
    return process.env.GEMINI_API_KEY?.trim() || null;
  }

  private getModel(): string {
    return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
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
        warnings: ["GEMINI_API_KEY no está configurada en las variables de entorno."],
      };
    }

    const timeoutMs = request.mode === "deep"
      ? (Number(process.env.AI_DEEP_TIMEOUT_MS) || 60000)
      : (Number(process.env.AI_FAST_TIMEOUT_MS) || 20000);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const systemInstruction = request.systemPrompt || "Eres un asistente legal experto en derecho mexicano.";
      const promptText = `${systemInstruction}\n\n[MENSAJE USUARIO]: ${request.userMessage}`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: promptText }],
              },
            ],
            generationConfig: {
              temperature: request.temperature ?? 0.1,
              maxOutputTokens: request.maxTokens ?? 2048,
            },
          }),
        }
      );

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Gemini API respondió con estado ${response.status}`);
      }

      const data = (await response.json()) as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      if (!text) {
        throw new Error("Gemini devolvió una respuesta vacía");
      }

      return {
        provider: this.id,
        model,
        success: true,
        content: text,
        latencyMs,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || null,
          completionTokens: data.usageMetadata?.candidatesTokenCount || null,
          totalTokens: data.usageMetadata?.totalTokenCount || null,
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
        lastError: "GEMINI_API_KEY no configurada",
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

export const geminiProviderInstance = new GeminiProvider();
