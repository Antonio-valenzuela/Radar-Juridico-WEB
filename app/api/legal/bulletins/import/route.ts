import { NextResponse } from 'next/server';

import {
  importManualBulletin,
  MANUAL_BULLETIN_LIMITS,
  ManualBulletinImportError,
  type ManualBulletinInput,
  type ManualBulletinMode,
} from '@/lib/bulletins/manualImport';
import { requireCaseAccess } from '@/lib/cases/access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function modeFrom(value: unknown, confirm?: unknown): ManualBulletinMode {
  if (confirm === true || confirm === 'true' || confirm === '1') return 'confirm';
  return value === 'confirm' ? 'confirm' : 'preview';
}

function requiredString(value: unknown, code: string, message: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ManualBulletinImportError(code, message, 400);
  }
  return value.trim();
}

async function inputFromMultipart(request: Request): Promise<ManualBulletinInput> {
  const form = await request.formData();
  const mode = modeFrom(form.get('mode'), form.get('confirm'));
  const previewToken = typeof form.get('previewToken') === 'string'
    ? String(form.get('previewToken')).trim() || undefined
    : undefined;
  const candidate = form.get('file') || form.get('pdf');

  if (candidate instanceof File) {
    const mimeType = (candidate.type || '').split(';', 1)[0].toLowerCase();
    if (mimeType === 'text/plain') {
      if (candidate.size > MANUAL_BULLETIN_LIMITS.textBytes) {
        throw new ManualBulletinImportError('PAYLOAD_TOO_LARGE', 'El archivo de texto excede el límite permitido.', 413);
      }
      return { type: 'text', mode, text: await candidate.text(), previewToken };
    }
    if (mimeType !== 'application/pdf') {
      throw new ManualBulletinImportError('UNSUPPORTED_MIME', 'Sólo se aceptan archivos PDF o texto plano.', 415);
    }
    if (candidate.size > MANUAL_BULLETIN_LIMITS.pdfBytes) {
      throw new ManualBulletinImportError('PAYLOAD_TOO_LARGE', 'El PDF excede el límite permitido.', 413);
    }
    return {
      type: 'pdf',
      mode,
      bytes: new Uint8Array(await candidate.arrayBuffer()),
      mimeType: candidate.type,
      filename: candidate.name,
      previewToken,
    };
  }

  const text = form.get('text');
  if (typeof text === 'string' && text.trim()) return { type: 'text', mode, text, previewToken };
  const url = form.get('url');
  if (typeof url === 'string' && url.trim()) return { type: 'url', mode, url: url.trim(), previewToken };
  throw new ManualBulletinImportError('INPUT_REQUIRED', 'Envía un PDF, texto plano o una URL HTTPS pública.', 400);
}

async function inputFromJson(request: Request): Promise<ManualBulletinInput> {
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    body = parsed as Record<string, unknown>;
  } catch {
    throw new ManualBulletinImportError('INVALID_JSON', 'El cuerpo JSON no es válido.', 400);
  }

  const mode = modeFrom(body.mode, body.confirm);
  const previewToken = typeof body.previewToken === 'string'
    ? body.previewToken.trim() || undefined
    : undefined;
  const type = body.type === 'url' || body.type === 'text'
    ? body.type
    : typeof body.url === 'string'
      ? 'url'
      : 'text';
  if (type === 'url') {
    return {
      type,
      mode,
      url: requiredString(body.url, 'URL_REQUIRED', 'La URL HTTPS pública es obligatoria.'),
      previewToken,
    };
  }
  return {
    type,
    mode,
    text: requiredString(body.text, 'TEXT_REQUIRED', 'El texto del boletín es obligatorio.'),
    previewToken,
  };
}

async function parseInput(request: Request) {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) return inputFromMultipart(request);
  if (contentType.includes('application/json')) return inputFromJson(request);
  throw new ManualBulletinImportError(
    'UNSUPPORTED_CONTENT_TYPE',
    'Usa application/json para texto/URL o multipart/form-data para archivos.',
    415,
  );
}

function isTypedImportError(error: unknown): error is { code: string; message: string; status: number } {
  if (error instanceof ManualBulletinImportError) return true;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as Record<string, unknown>;
  return typeof candidate.code === 'string'
    && typeof candidate.message === 'string'
    && typeof candidate.status === 'number';
}

export async function POST(request: Request) {
  const access = await requireCaseAccess(request);
  if (!access.ok) return access.response;

  try {
    const input = await parseInput(request);
    const result = await importManualBulletin(input, {
      organizationId: access.context.organizationId,
      userId: access.context.userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isTypedImportError(error)) {
      return NextResponse.json({
        ok: false,
        error: error.code,
        message: error.message,
      }, { status: error.status });
    }
    console.error('[legal/bulletins/import] import failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({
      ok: false,
      error: 'IMPORT_FAILED',
      message: 'No fue posible importar el boletín.',
    }, { status: 500 });
  }
}
