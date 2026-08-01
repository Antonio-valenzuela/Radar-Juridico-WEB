import { prisma } from "@/lib/prisma";
import { routeLlmCompletion } from "./router";

export interface NormaDiffAiSummary {
  executiveSummary: string;
  practicalImpact: string;
  recommendedAction: string;
}

export async function generateNormaDiffSummary(diffId: string): Promise<NormaDiffAiSummary | null> {
  try {
    const diff = await prisma.normaDiff.findUnique({
      where: { id: diffId },
      include: {
        toVersion: {
          include: {
            norma: true,
          },
        },
      },
    });

    if (!diff) return null;

    // Return cached summary if already generated
    if (diff.executiveSummary && diff.practicalImpact && diff.recommendedAction) {
      return {
        executiveSummary: diff.executiveSummary,
        practicalImpact: diff.practicalImpact,
        recommendedAction: diff.recommendedAction,
      };
    }

    const normaName = diff.toVersion?.norma?.nombre || "Norma Jurídica";
    const changedArticles = Array.isArray(diff.changedArticles) ? diff.changedArticles : [];
    const summaryBullets = Array.isArray(diff.summaryBullets) ? diff.summaryBullets : [];

    // Fallback if no changed articles
    if (changedArticles.length === 0 && summaryBullets.length === 0) {
      const fallback: NormaDiffAiSummary = {
        executiveSummary: `Reforma publicada para ${normaName}. Se requiere consultar la fuente oficial para verificar el texto completo.`,
        practicalImpact: `Revisar aplicabilidad según la materia y fecha de entrada en vigor de la norma.`,
        recommendedAction: `Verificar la publicación oficial correspondiente y actualizar registros legales.`,
      };

      await prisma.normaDiff.update({
        where: { id: diffId },
        data: fallback,
      });

      return fallback;
    }

    // Format changed articles for prompt
    const articlesFormatted = (changedArticles as Array<Record<string, unknown>>).map((art, idx) => {
      const num = art.articleId || art.title || `Artículo ${idx + 1}`;
      const changeType = art.type || art.changeType || "modificación";
      const snippet = art.after || art.snippet || art.content || "";
      return `- ${num} (${changeType}): ${String(snippet).slice(0, 400)}`;
    }).join("\n");

    const bulletsFormatted = (summaryBullets as string[]).map((b) => `- ${b}`).join("\n");

    const prompt = `Eres un consultor jurídico experto en derecho mexicano.
Analiza las siguientes modificaciones por artículo tomadas de la norma "${normaName}":

MUESTRA DE ARTÍCULOS MODIFICADOS:
${articlesFormatted || bulletsFormatted}

REGLAS OBLIGATORIAS:
1. Cita explícitamente los números de artículo exactos tomados de la lista anterior.
2. Queda ESTRICTAMENTE PROHIBIDO mencionar, citar o inventar números de artículo que NO aparezcan en la lista anterior.
3. Devuelve únicamente un objeto JSON válido con exactamente la siguiente estructura de 3 campos:

{
  "executiveSummary": "Resumen ejecutivo claro y preciso del alcance de los cambios, citando los artículos específicos.",
  "practicalImpact": "Impacto práctico directo para abogados litigantes, empresas o ciudadanos afectados.",
  "recommendedAction": "Acción recomendada concreta y paso a paso que debe tomar el profesional del derecho."
}`;

    const result = await routeLlmCompletion(prompt, "norma_diff_summary");
    let summary: NormaDiffAiSummary | null = null;

    try {
      // Clean JSON if returned with markdown code blocks
      const cleanJson = result.answer.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.executiveSummary && parsed.practicalImpact && parsed.recommendedAction) {
        summary = {
          executiveSummary: String(parsed.executiveSummary),
          practicalImpact: String(parsed.practicalImpact),
          recommendedAction: String(parsed.recommendedAction),
        };
      }
    } catch {
      // JSON parsing failed, build deterministic response
      summary = null;
    }

    if (!summary) {
      const artListStr = (changedArticles as Array<Record<string, unknown>>)
        .map((a) => a.articleId || a.title)
        .filter(Boolean)
        .join(", ");

      summary = {
        executiveSummary: `Reforma a ${normaName} impactando las secciones: ${artListStr || "artículos señalados en la publicación"}.`,
        practicalImpact: `Los cambios afectan la interpretación y aplicación procesal o sustantiva de los artículos ${artListStr || "modificados"}.`,
        recommendedAction: `Analizar el texto oficial de los artículos ${artListStr || "modificados"} y ajustar promociones o contratos vigentes.`,
      };
    }

    // Cache in database
    await prisma.normaDiff.update({
      where: { id: diffId },
      data: summary,
    });

    return summary;
  } catch (error) {
    console.error(`[generateNormaDiffSummary] Error for diffId ${diffId}:`, error);
    return null;
  }
}
