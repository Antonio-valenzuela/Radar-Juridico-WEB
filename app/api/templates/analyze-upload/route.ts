import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/adminAuth';
import { extractDocument } from '@/lib/pdf/documentExtractor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Response shape ─────────────────────────────────────────────────────────────

export interface AnalyzeResult {
  ok: boolean;
  /** Full extracted text for use by AI legal analysis */
  extractedText: string;
  /** True when OCR was used to obtain the text */
  needsOcr: boolean;
  /** Original file name */
  sourceFileName: string;
  /** Detected MIME type */
  mimeType: string;
  /**
   * True when the extraction pipeline validated the source for AI use.
   * When false, the client must NOT invoke AI legal analysis automatically.
   */
  sourceValidated: boolean;
  /** How the source was validated */
  sourceValidationMethod: string;
  /** Which OCR provider was used, if any */
  ocrProvider: string | null;
  /** Structured quality metrics */
  qualityScore: {
    confidence: number;
    qualityLabel: string;
    pageCount: number;
    textLength: number;
    avgCharsPerPage: number;
    status: 'READY' | 'NEEDS_OCR' | 'LOW_QUALITY' | 'FAILED';
    ocrUsed: boolean;
    emptyPages: number;
  };
  /** Ordered extraction steps for the UI */
  extractionSteps: Array<{
    step: number;
    label: string;
    done: boolean;
    status: 'pending' | 'ok' | 'warn' | 'error' | 'running';
    detail?: string;
  }>;
  /** Per-page breakdown for traceability */
  pages: Array<{
    page: number;
    text: string;
    chars: number;
  }>;
  /** Legal document classification */
  classification: {
    es_juridico: boolean;
    tipo_documento: string;
    confianza: number;
    razon: string;
    secciones_detectadas: string[];
  };
  structureJson: null;
  /** Human-readable warnings (no secrets) */
  warnings: string[];
  /** Pipeline status */
  pipelineStatus: 'READY' | 'NEEDS_MANUAL_REVIEW' | 'FAILED';
  error?: string;
}

// ── Heuristic legal classifier ─────────────────────────────────────────────────

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

// ── POST /api/templates/analyze-upload ────────────────────────────────────────

import { requireLawyerAccess } from '@/lib/security/lawyerAuth';

export async function POST(request: NextRequest) {
  const auth = await requireLawyerAccess(request);
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No se recibió ningún archivo.' }, { status: 400 });
    }

    const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'El archivo excede el tamaño máximo permitido de 15 MB.' },
        { status: 413 }
      );
    }

    const fileName = file.name || 'archivo';
    const mimeType = file.type || '';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    // Guard: reject unsupported formats before allocating memory
    const supportedExts = ['pdf', 'docx', 'doc', 'txt', 'rtf', 'jpg', 'jpeg', 'png'];
    if (!supportedExts.includes(ext) && !mimeType.startsWith('image/') && !mimeType.includes('pdf')) {
      return NextResponse.json(
        {
          ok: false,
          error: `Formato no soportado: .${ext}. Los formatos aceptados son: .pdf, .docx, .doc, .txt, .rtf, .jpg, .jpeg, .png`,
          unsupported: true,
        },
        { status: 415 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── Run universal extraction pipeline ─────────────────────────────────────
    const result = await extractDocument({ buffer, fileName, mimeType });

    // ── Classify legal content (only on validated text) ───────────────────────
    const classification = result.text.length > 50
      ? classifyLegalText(result.text)
      : {
          es_juridico: false,
          tipo_documento: 'Sin texto suficiente para clasificar',
          confianza: 0,
          razon: 'Texto insuficiente.',
          secciones_detectadas: [],
        };

    // Build response — always includes sourceValidated flag
    const response: AnalyzeResult = {
      ok: true,
      extractedText: result.text,
      needsOcr: result.ocrUsed || !result.sourceValidated,
      sourceFileName: fileName,
      mimeType,
      sourceValidated: result.sourceValidated,
      sourceValidationMethod: result.sourceValidationMethod,
      ocrProvider: result.ocrProvider,
      qualityScore: {
        confidence: result.qualityScore.confidence,
        qualityLabel: result.qualityScore.qualityLabel,
        pageCount: result.pageCount,
        textLength: result.textLength,
        avgCharsPerPage: result.avgCharsPerPage,
        status: result.qualityScore.status,
        ocrUsed: result.ocrUsed,
        emptyPages: result.qualityScore.emptyPages,
      },
      extractionSteps: result.extractionSteps,
      pages: result.pages,
      classification,
      structureJson: null,
      warnings: result.warnings,
      pipelineStatus: result.status,
    };

    return NextResponse.json(response satisfies AnalyzeResult);
  } catch (err: any) {
    console.error('[analyze-upload] Error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Error al procesar el archivo.' },
      { status: 500 }
    );
  }
}
