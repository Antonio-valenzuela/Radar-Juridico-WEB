// lib/rag/answer.ts

import { hybridSearch } from '@/lib/search/hybridSearch';
import { generateLlmCompletion } from '@/lib/ai-provider';
import { getAndIncrementAttempts } from '@/lib/legal-radar';
import { buildRagPrompt } from './prompts';
import { prisma } from '@/lib/prisma';

/**
 * High-level RAG answer used by tests and the /api/rag route.
 * Returns a stable contract: { ok, answer, sources, attempts }
 */
export async function answerQuestion(
  question: string,
  limit = 5
): Promise<{
  ok: boolean;
  answer: string;
  sources: Array<{ title: string; fuente: string; fecha: string; excerpt: string }>;
  attempts: { limit: number; used: number; remaining: number };
}> {
  const attempts = await getAndIncrementAttempts();

  // 1. Search local DB (gracefully handle schema mismatches / connectivity errors)
  let relevantDocs: Awaited<ReturnType<typeof hybridSearch>> = [];
  try {
    relevantDocs = await hybridSearch(question, {}, limit);
    // Tolerancia para puntuación no numérica en coincidencia de RAG
    relevantDocs.forEach(c => {
      if (c && !Number.isFinite(c.score)) {
        c.score = 0;
      }
    });
  } catch (dbErr) {
    console.warn('[answerQuestion] hybridSearch error (treated as empty):', dbErr instanceof Error ? dbErr.message : dbErr);
  }

  // Fallback: si hybridSearch no encontró docs en la tabla Document,
  // buscar directamente en la tabla Item (donde están los artículos ingestados)
  if (relevantDocs.length === 0) {
    try {
      const fallbackItems = await prisma.item.findMany({
        where: {
          OR: [
            { title: { contains: question, mode: 'insensitive' } },
            { summary: { contains: question, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { published: 'desc' },
      });

      if (fallbackItems.length > 0) {
        relevantDocs = fallbackItems.map((item: any) => ({
          documento: item.title || 'Sin título',
          coincidencia_semantica: 0,
          coincidencia_textual: 50,
          fuente: item.source || 'Base local',
          fragmento_relevante: item.summary || item.title || '',
          fecha: item.published ? new Date(item.published).toISOString().slice(0, 10) : 'Fecha desconocida',
          score: 0.5,
        }));
      }
    } catch (fallbackErr) {
      console.warn('[answerQuestion] Item fallback error:', fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
    }
  }

  if (relevantDocs.length === 0) {
    return {
      ok: true,
      answer: 'No encontré documentos suficientes en la base legal indexada para responder con precisión.',
      sources: [],
      attempts,
    };
  }

  // 2. Build context chunks
  const contextChunks = relevantDocs.map(
    (doc) => `Título: ${doc.documento}\nFuente: ${doc.fuente}\nFecha: ${doc.fecha}\nContenido: ${doc.fragmento_relevante}`
  );

  const prompt = buildRagPrompt(question, contextChunks);

  // 3. Call LLM
  try {
    const completion = await generateLlmCompletion(prompt, 'rag_answer');
    return {
      ok: true,
      answer: completion.answer,
      sources: relevantDocs.map((doc) => ({
        title: doc.documento,
        fuente: doc.fuente,
        fecha: doc.fecha,
        excerpt: doc.fragmento_relevante,
      })),
      attempts,
    };
  } catch (err) {
    return {
      ok: false,
      answer: 'Error al generar la respuesta.',
      sources: [],
      attempts,
    };
  }
}

const RAG_SYSTEM_PROMPT = `Eres un asistente jurídico especializado en regulaciones mexicanas.

REGLAS ESTRICTAS:
1. Solo responde basándote en los documentos proporcionados en el contexto.
2. Si no hay información suficiente en el contexto para responder la pregunta, di "No encontré información suficiente sobre esto en los documentos indexados".
3. SIEMPRE cita de manera estricta el documento fuente, fragmento relevante y fecha de cada afirmación que hagas.
4. Nunca inventes información o hagas inferencias más allá de lo explícito en los documentos proporcionados.
5. Mantén un tono sumamente conciso, profesional y formal.

Formato de respuesta obligatorio (debes responder ÚNICAMENTE con un objeto JSON válido que cumpla este esquema):
{
  "respuesta": "Tu respuesta detallada y coherente basada en el contexto",
  "citas": [
    {
      "documento": "Título exacto del documento citado",
      "fuente": "DOF | SCJN | SJF",
      "fecha": "YYYY-MM-DD",
      "fragmento": "El fragmento o párrafo de texto exacto en el que te basas para dar esta respuesta",
      "confianza": 0.95
    }
  ]
}`;

export async function generateRAGAnswer(question: string) {
  // 1. Buscar documentos relevantes
  let relevantDocs = await hybridSearch(question, {}, 5);

  // Fallback: buscar en tabla Item si Document no tiene resultados
  if (relevantDocs.length === 0) {
    try {
      const fallbackItems = await prisma.item.findMany({
        where: {
          OR: [
            { title: { contains: question, mode: 'insensitive' } },
            { summary: { contains: question, mode: 'insensitive' } },
          ],
        },
        take: 5,
        orderBy: { published: 'desc' },
      });

      if (fallbackItems.length > 0) {
        relevantDocs = fallbackItems.map((item: any) => ({
          documento: item.title || 'Sin título',
          coincidencia_semantica: 0,
          coincidencia_textual: 50,
          fuente: item.source || 'Base local',
          fragmento_relevante: item.summary || item.title || '',
          fecha: item.published ? new Date(item.published).toISOString().slice(0, 10) : 'Fecha desconocida',
          score: 0.5,
        }));
      }
    } catch (fallbackErr) {
      console.warn('[generateRAGAnswer] Item fallback error:', fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
    }
  }

  if (relevantDocs.length === 0) {
    return {
      respuesta: 'No encontré información relevante en la base de datos regulatoria.',
      citas: [],
    };
  }

  // 2. Construir el contexto para la IA
  const context = relevantDocs
    .map(
      (doc, idx) =>
        `DOCUMENTO [${idx + 1}]:\nTítulo: ${doc.documento}\nFuente: ${doc.fuente}\nFecha: ${doc.fecha}\nContenido: ${doc.fragmento_relevante}`
    )
    .join('\n\n---\n\n');

  // 3. Formular prompt
  const fullPrompt = `${RAG_SYSTEM_PROMPT}\n\nCONTEXTO DE DOCUMENTOS LEGALES:\n${context}\n\nPREGUNTA DEL USUARIO: ${question}\n\nRecuerda responder ÚNICAMENTE con el objeto JSON y nada más.`;

  // 4. Invocar completion
  const completion = await generateLlmCompletion(fullPrompt, 'rag_answer');

  // 5. Limpiar y parsear respuesta JSON
  try {
    const cleanedAnswer = cleanJsonResponse(completion.answer);
    return JSON.parse(cleanedAnswer);
  } catch (error) {
    console.error('Error parseando JSON de RAG Rersponse. Crudo:', completion.answer, error);
    
    // Fallback: si la IA no devolvió JSON pero sí texto, armamos un objeto rudimentario
    // mapeando el primer documento de coincidencia como cita
    const firstDoc = relevantDocs[0];
    return {
      respuesta: completion.answer || 'No se pudo estructurar la respuesta.',
      citas: [
        {
          documento: firstDoc.documento,
          fuente: firstDoc.fuente,
          fecha: firstDoc.fecha,
          fragmento: firstDoc.fragmento_relevante,
          confianza: 0.70,
        },
      ],
    };
  }
}

function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();
  // Quitar bloques de código markdown ```json ... ``` si existen
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  }
  return cleaned;
}
