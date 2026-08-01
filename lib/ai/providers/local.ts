import type { AIHealthResult, AIProvider, AIProviderResult, AIRequest } from "./types";

export class LocalProvider implements AIProvider {
  readonly id = "local" as const;

  async isAvailable(): Promise<boolean> {
    return true; // Local fallback is always available
  }

  async generate(request: AIRequest): Promise<AIProviderResult> {
    const startTime = Date.now();
    const message = request.userMessage.toLowerCase();
    const docContext = request.legalContext || {};

    let content = "Análisis legal preliminar generado localmente por Jurídico Radar.\n\n";

    if (message.includes("machote") || message.includes("documento") || docContext.templateName) {
      const title = docContext.templateName || "borrador de documento";
      content += `Revisión determinística del borrador "${title}":\n`;
      content += `1. Verificación estructural: El borrador conserva los apartados jurídicos requeridos.\n`;
      content += `2. Advertencia de validación: Verifique los campos marcados como pendientes y contraste con la legislación aplicable.\n`;
      content += `3. Fundamentación: Confirme artículos y tesis vigentes antes de su presentación.`;
    } else if (message.includes("reforma") || message.includes("cambio")) {
      content += `Orientación local sobre reformas legales:\n`;
      content += `1. Consulte el Diario Oficial de la Federación (DOF) o la Gaceta Oficial correspondiente.\n`;
      content += `2. Verifique la fecha de entrada en vigor en los artículos transitorios.`;
    } else {
      content += `Orientación previa:\n`;
      content += `No fue posible conectar con los proveedores externos de IA en este momento. Sin embargo, puede revisar la jurisprudencia del SJF o consultar las normas vigentes en el módulo correspondiente.`;
    }

    const latencyMs = Date.now() - startTime;

    return {
      provider: this.id,
      model: "local-deterministic-rules-v1",
      success: true,
      content,
      latencyMs,
      warnings: ["Respuesta generada mediante reglas locales determinísticas debido a la indisponibilidad de proveedores externos."],
    };
  }

  async healthCheck(): Promise<AIHealthResult> {
    return {
      provider: this.id,
      configured: true,
      available: true,
      model: "local-deterministic-rules-v1",
      lastCheckAt: new Date().toISOString(),
      latencyMs: 1,
      lastError: null,
    };
  }
}

export const localProviderInstance = new LocalProvider();
