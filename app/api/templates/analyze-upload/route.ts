import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/adminAuth';
import { extractPdfTextServer } from '@/lib/pdf/pdfExtractor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface AnalyzeResult {
  ok: boolean;
  extractedText: string;
  needsOcr: boolean;
  sourceFileName: string;
  mimeType: string;
  classification: {
    es_juridico: boolean;
    tipo_documento: string;
    confianza: number;
    razon: string;
    secciones_detectadas: string[];
  };
  structureJson: null;
  error?: string;
}

/** Heurística liviana para determinar si el texto parece jurídico */
function classifyLegalText(text: string): AnalyzeResult['classification'] {
  const lower = text.toLowerCase();
  const keywords = [
    'considerando', 'por tanto', 'quejoso', 'demandado', 'actor', 'demandante',
    'juzgado', 'tribunal', 'juicio', 'amparo', 'expediente', 'notifíquese',
    'resuelve', 'visible', 'autos', 'promovente', 'accionante', 'magistrado',
    'contrato', 'convenio', 'obligación', 'cláusula', 'testamento', 'herencia',
    'código civil', 'código de comercio', 'ley de amparo', 'constitución',
    'artículo', 'fracción', 'párrafo', 'diario oficial', 'semanario judicial',
  ];
  const matches = keywords.filter((kw) => lower.includes(kw));
  const ratio = matches.length / keywords.length;

  const secciones: string[] = [];
  if (/antecedentes|hechos/i.test(text)) secciones.push('Hechos / Antecedentes');
  if (/considerando|fundamentos|derecho/i.test(text)) secciones.push('Fundamentos jurídicos');
  if (/por tanto|resuelve|petitorio/i.test(text)) secciones.push('Puntos petitorios');
  if (/pruebas|evidencias/i.test(text)) secciones.push('Pruebas');
  if (/firma|atentamente|promovente/i.test(text)) secciones.push('Firma');

  const tipos: Record<string, RegExp> = {
    'Demanda de amparo': /amparo/i,
    'Demanda civil': /demanda.{0,30}(civil|mercan)/i,
    'Contrato': /contrato|convenio/i,
    'Testamento': /testamento/i,
    'Escrito jurídico general': /juzgado|tribunal|autoridad/i,
  };
  let tipo_documento = 'Documento jurídico';
  for (const [nombre, re] of Object.entries(tipos)) {
    if (re.test(text)) { tipo_documento = nombre; break; }
  }

  return {
    es_juridico: ratio >= 0.08 || matches.length >= 3,
    tipo_documento,
    confianza: Math.round(Math.min(ratio * 4, 1) * 100),
    razon: matches.length >= 3
      ? `Encontradas ${matches.length} palabras clave jurídicas: ${matches.slice(0, 5).join(', ')}.`
      : 'No se detectaron suficientes indicios jurídicos.',
    secciones_detectadas: secciones,
  };
}

export async function POST(request: NextRequest) {
  // Auth: público cuando ENABLE_PUBLIC_AI=true, protegido en producción cerrada
  const auth = requireAdmin(request as unknown as Request);
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'El archivo excede el tamaño máximo permitido de 15 MB.' },
        { status: 413 }
      );
    }

    const fileName = file.name || 'archivo';
    const mimeType = file.type || '';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    let extractedText = '';
    let needsOcr = false;

    // ── TXT ─────────────────────────────────────────────────────────────
    if (ext === 'txt' || mimeType.includes('text/plain')) {
      extractedText = await file.text();
    }

    // ── PDF ─────────────────────────────────────────────────────────────
    else if (ext === 'pdf' || mimeType === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      try {
        const result = await extractPdfTextServer(buffer);
        extractedText = result.text?.trim() || '';
        if (extractedText.length < 50) {
          needsOcr = true;
          extractedText = '';
        }
      } catch (err) {
        console.warn('[analyze-upload] PDF extraction failed:', err);
        needsOcr = true;
        extractedText = '';
      }
    }

    // ── DOCX ────────────────────────────────────────────────────────────
    else if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value?.trim() || '';
      } catch (err) {
        console.warn('[analyze-upload] DOCX extraction failed:', err);
        return NextResponse.json(
          { ok: false, error: 'No se pudo leer el archivo DOCX. Verifica que no esté dañado o protegido.' },
          { status: 422 }
        );
      }
    }

    // ── DOC (legacy) ─────────────────────────────────────────────────────
    else if (ext === 'doc' || mimeType === 'application/msword') {
      return NextResponse.json(
        {
          ok: false,
          error: 'El formato .doc (Word antiguo) no está soportado todavía. Guarda el archivo como .docx o copia el texto y pégalo en el campo de texto.',
          unsupported: true,
        },
        { status: 415 }
      );
    }

    // ── Formato no soportado ─────────────────────────────────────────────
    else {
      return NextResponse.json(
        {
          ok: false,
          error: `Formato no soportado: .${ext}. Los formatos aceptados son: .pdf, .docx, .txt`,
          unsupported: true,
        },
        { status: 415 }
      );
    }

    // ── Manejo de PDFs escaneados / Archivos que requieren OCR ────────────
    if (needsOcr && !extractedText) {
      return NextResponse.json({
        ok: true,
        extractedText: '',
        needsOcr: true,
        sourceFileName: fileName,
        mimeType,
        classification: {
          es_juridico: true,
          tipo_documento: 'PDF escaneado / Documento adjunto',
          confianza: 75,
          razon: 'PDF escaneado aceptado correctamente. Puedes guardar el machote directamente o pegar el texto si deseas edición avanzada.',
          secciones_detectadas: ['Documento completo adjunto'],
        },
        structureJson: null,
      } satisfies AnalyzeResult);
    }

    if (!extractedText) {
      return NextResponse.json(
        { ok: false, error: 'El archivo no contiene texto extraíble.' },
        { status: 422 }
      );
    }

    const classification = classifyLegalText(extractedText);

    return NextResponse.json({
      ok: true,
      extractedText,
      needsOcr: false,
      sourceFileName: fileName,
      mimeType,
      classification,
      structureJson: null, // La estructuración con IA se hace opcionalmente desde el modal
    } satisfies AnalyzeResult);
  } catch (err: any) {
    console.error('[analyze-upload] Error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Error al procesar el archivo.' },
      { status: 500 }
    );
  }
}
