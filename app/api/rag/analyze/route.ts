import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { generateLlmCompletion } from "@/lib/ai-provider";
import { getAndIncrementAttempts } from "@/lib/legal-radar";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const adminCheck = requireAdmin(req);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const query = (body.question || body.query || body.keyword || "").trim();
    const localResults = body.localResults || [];
    const weeklyChanges = body.weeklyChanges || [];
    const externalResults = body.externalResults || [];

    if (!query) {
      return NextResponse.json({ error: "El parametro 'question', 'query' o 'keyword' es obligatorio." }, { status: 400 });
    }

    const attempts = await getAndIncrementAttempts();
    let aiAnalysis = {
      summary: "No encontré información suficiente en fuentes oficiales para responder con precisión.",
      legalImpact: "Sin impacto detectado.",
      attentionPoints: [] as string[],
      provider: "none",
      model: "none",
      usedFallback: false
    };

    if (localResults.length > 0 || weeklyChanges.length > 0 || externalResults.length > 0) {
      const prompt = `Actúa como un analista legal experto y asesor jurídico para abogados en México.
Analiza la siguiente palabra clave o consulta de búsqueda y sintetiza la información recuperada de fuentes oficiales.

Consulta del usuario: "${query}"

Resultados Locales Recuperados:
${JSON.stringify(localResults.slice(0, 10), null, 2)}

Cambios y Reformas Semanales Detectados:
${JSON.stringify(weeklyChanges.slice(0, 10), null, 2)}

Resultados Externos Oficiales Validados:
${JSON.stringify(externalResults.slice(0, 10), null, 2)}

Genera un informe analítico estructurado en formato JSON estricto. El JSON debe contener exactamente estos campos:
{
  "summary": "Resumen ejecutivo explicando los hallazgos principales de manera clara y profesional.",
  "legalImpact": "Explicación del impacto práctico y jurídico para los abogados y sus clientes en México.",
  "attentionPoints": [
    "Punto de atención 1...",
    "Punto de atención 2..."
  ]
}

IMPORTANTE: 
1. Responde únicamente con el objeto JSON estructurado. No agregues texto explicativo ni bloques markdown.
2. Basate exclusivamente en los datos proporcionados. No inventes leyes ni reformas que no figuren en los datos de entrada.
3. Si la lista de resultados está vacía, no inventes información.`;

      console.error(`Calling LLM provider: ${process.env.LLM_PROVIDER || "gemini"}`);
      const llmResult = await generateLlmCompletion(prompt);
      console.error("LLM response received");

      let cleanAnswer = llmResult.answer.trim();
      if (cleanAnswer.startsWith("```")) {
        cleanAnswer = cleanAnswer.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
      }

      try {
        const jsonParsed = JSON.parse(cleanAnswer);
        aiAnalysis = {
          summary: jsonParsed.summary || "",
          legalImpact: jsonParsed.legalImpact || "",
          attentionPoints: Array.isArray(jsonParsed.attentionPoints) ? jsonParsed.attentionPoints : [],
          provider: llmResult.provider,
          model: llmResult.model,
          usedFallback: llmResult.usedFallback
        };
      } catch (parseErr) {
        console.error("Failed to parse LLM response as JSON:", parseErr);
        aiAnalysis = {
          summary: cleanAnswer,
          legalImpact: "No se pudo parsear el impacto de la respuesta estructurada.",
          attentionPoints: [],
          provider: llmResult.provider,
          model: llmResult.model,
          usedFallback: llmResult.usedFallback
        };
      }
    }

    return NextResponse.json({ query, aiAnalysis, attempts });

  } catch (error: any) {
    console.error("API /api/rag/analyze error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
