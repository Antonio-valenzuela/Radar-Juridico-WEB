import { LegalAiInput } from "../ai/types";

export interface ExternalContextResult {
  context: string;
  sourceGrounding: { title: string; url?: string }[];
}

/**
 * Retrieves external context for a document if enabled by environment variables.
 * Designed to provide regulatory grounding without mixing with the official text.
 */
export async function getExternalContext(
  input: LegalAiInput
): Promise<ExternalContextResult | null> {
  const isEnabled = process.env.AI_ENABLE_EXTERNAL_CONTEXT === "true";
  if (!isEnabled) {
    return null;
  }

  try {
    // Architecture is prepared to query the AI model or a search API (e.g. Tavily)
    // for external grounding. For now, we return a structured contextual mock
    // citing official regulatory sources, avoiding hallucinations or web scraping.
    return {
      context: `Antecedentes normativos y contexto complementario para la publicación: "${input.title}". Este acto administrativo o legislativo se relaciona con las facultades regulatorias aplicables y el marco jurídico federal vigente.`,
      sourceGrounding: [
        {
          title: "Diario Oficial de la Federación (DOF)",
          url: "https://dof.gob.mx",
        },
        {
          title: "Cámara de Diputados - Leyes Federales Vigentes",
          url: "https://www.diputados.gob.mx/LeyesBiblio/",
        },
      ],
    };
  } catch (error) {
    console.error("Error generating external context:", error);
    return null;
  }
}
