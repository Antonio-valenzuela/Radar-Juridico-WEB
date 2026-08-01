export type AIProviderId = "gemini" | "groq" | "openrouter" | "local";

export interface AIRequest {
  systemPrompt?: string;
  userMessage: string;
  mode?: "fast" | "deep";
  taskType?: string;
  legalContext?: Record<string, any>;
  retrievedSources?: Array<{
    id?: string;
    title: string;
    officialUrl?: string;
    sourceType?: string;
    snippet?: string;
  }>;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  outputSchema?: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
  requestId?: string;
}

export interface AIProviderResult {
  provider: AIProviderId;
  model: string;
  success: boolean;
  content: string;
  structuredOutput?: Record<string, any> | null;
  latencyMs: number;
  usage?: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    estimatedCost?: number;
  };
  finishReason?: string;
  errorCode?: string | null;
  retryable?: boolean;
  citations?: Array<{ title: string; url?: string | null; fuente?: string; materia?: string }>;
  warnings?: string[];
}

export interface AIHealthResult {
  provider: AIProviderId;
  configured: boolean;
  available: boolean;
  model: string;
  lastCheckAt: string;
  latencyMs?: number;
  lastError?: string | null;
}

export interface AIProvider {
  id: AIProviderId;
  isAvailable(): Promise<boolean>;
  generate(request: AIRequest): Promise<AIProviderResult>;
  healthCheck(): Promise<AIHealthResult>;
}

export function sanitizeAiError(err: unknown): string {
  if (!err) return "Error desconocido";
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/key=[^&\s]+/gi, "key=[REDACTED]")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .slice(0, 300);
}
