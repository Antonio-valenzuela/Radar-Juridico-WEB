import { NextRequest, NextResponse } from 'next/server';
import { runFastMode } from '@/lib/ai/orchestrator';
import { checkRateLimit, extractIp } from '@/lib/security/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const ip = extractIp(req);
    const rateLimitResult = checkRateLimit(ip, 20);
    if (!rateLimitResult.ok) {
      return NextResponse.json(
        { ok: false, error: 'rate_limit', friendlyMessage: 'Demasiadas solicitudes de generación.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { prompt, documentType, sectionType, sectionTitle } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'invalid_prompt', message: 'El prompt es obligatorio.' },
        { status: 400 }
      );
    }

    const systemPrompt = `Eres un abogado litigante mexicano experto con 20 años de práctica forense en materias laboral, civil, mercantil, administrativa y constitucional.

Generas secciones de escritos judiciales con altísimo rigor técnico, apego a la legislación mexicana vigente y técnica de argumentación jurídica (silogismo jurídico, ponderación de derechos, suplencia de la queja cuando aplica).

REGLAS ESTRICTAS DE SEGURIDAD JURÍDICA:
1. NUNCA inventes jurisprudencias, números de registro digital, fechas, nombres de partes o expedientes que no se te hayan proporcionado explícitamente.
2. Si falta un dato indispensable para la redacción, utiliza la marca exacta: [DATO PENDIENTE: descripción del dato que falta].
3. Si estás haciendo una inferencia razonable pero no confirmada, añade al inicio del párrafo: [INFERENCIA DE IA].
4. Si el contenido proviene directamente de un documento fuente, mantén la fidelidad fáctica sin agregar hechos inexistentes.
5. Redacta en estilo formal forense de los tribunales mexicanos (uso de negritas en títulos, párrafos justificados, listas ordenadas con ordinales PRIMERO, SEGUNDO, etc.).`;

    const aiResult = await runFastMode({
      systemPrompt,
      userMessage: prompt,
      mode: 'fast',
      taskType: 'document_generation',
    });

    if (!aiResult.success || !aiResult.content) {
      return NextResponse.json(
        { ok: false, error: 'generation_failed', message: 'El proveedor de IA no devolvió un resultado válido.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      text: aiResult.content.trim(),
      warnings: [],
      provider: aiResult.provider || 'ai-orchestrator',
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Error al generar la sección.' },
      { status: 500 }
    );
  }
}
