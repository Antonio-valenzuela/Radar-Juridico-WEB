/**
 * OCR Provider Abstraction Layer
 *
 * Defines a pluggable interface for OCR providers. Each provider handles
 * a specific backend (mock, iLoveAPI, Google Document AI, etc.) without
 * coupling the rest of the system to any specific implementation.
 *
 * Adding a new provider: implement DocumentOCRProvider and register it
 * in getOCRProvider() below.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OCRPageResult {
  page: number;
  text: string;
  chars: number;
}

export interface OCRResult {
  /** Full concatenated text from all pages */
  text: string;
  /** Per-page breakdown for traceability and semantic retrieval */
  pages: OCRPageResult[];
  /** Overall confidence 0-100 */
  confidence: number;
  /** Which provider actually processed this */
  provider: string;
  /** Total pages detected */
  pageCount: number;
  /** Duration in ms */
  durationMs: number;
  /** Any provider-specific warnings */
  warnings: string[];
}

export interface OCRInput {
  buffer: Buffer;
  /** e.g. 'application/pdf', 'image/jpeg', 'image/png' */
  mimeType: string;
  /** Suggested OCR language, e.g. 'spa' for Spanish */
  language?: string;
  /** Original filename for logging */
  fileName?: string;
}

/** Contract all OCR providers must implement */
export interface DocumentOCRProvider {
  /** Unique identifier for logging / config */
  readonly name: string;
  /** True when this provider can handle the given mimeType */
  supports(mimeType: string): boolean;
  /** Perform OCR and return structured result */
  process(input: OCRInput): Promise<OCRResult>;
}

// ── Extraction Log ─────────────────────────────────────────────────────────────

export interface ExtractionLog {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  pageCount: number;
  method: 'native' | 'ocr' | 'fallback' | 'manual';
  provider: string | null;
  durationMs: number;
  confidenceBefore: number;
  confidenceAfter: number;
  qualityBefore: string;
  qualityAfter: string;
  ocrUsed: boolean;
  errors: string[];
  warnings: string[];
  // Never log: secrets, API keys, tokens, or full document content
}

// ── Mock OCR Provider ──────────────────────────────────────────────────────────

/**
 * Mock provider for local development / CI.
 * Set OCR_PROVIDER=mock in .env.local to activate.
 * Returns realistic-looking test data without consuming API credits.
 */
export class MockOCRProvider implements DocumentOCRProvider {
  readonly name = 'mock';

  supports(mimeType: string): boolean {
    return (
      mimeType === 'application/pdf' ||
      mimeType.startsWith('image/')
    );
  }

  async process(input: OCRInput): Promise<OCRResult> {
    const start = Date.now();
    // Simulate a realistic OCR delay (50-150ms in tests)
    await new Promise((r) => setTimeout(r, 50));

    // Generate deterministic mock text for testing without random fake expedientes
    const estimatedPages = Math.max(1, Math.ceil(input.buffer.length / 50_000));
    const fileNameText = input.fileName ? `Archivo: ${input.fileName}` : 'Documento base';
    const mockText = Array.from({ length: estimatedPages }, (_, i) =>
      [
        `PÁGINA ${i + 1} (${fileNameText})`,
        `[EXTRACCIÓN DE PRUEBA - MODO MOCK LOCAL]`,
        `En la ciudad de Guadalajara, Jalisco, siendo las diez horas del día doce de agosto de dos mil veintiséis.`,
        `VISTOS para resolver el asunto relativo al expediente de la causa presentada,`,
        `relativo al juicio promovido por el promovente en contra de los actos reclamados de la autoridad emisora,`,
        `CONSIDERANDO: Que este tribunal es competente para conocer del presente asunto,`,
        `en términos del artículo 107 de la Constitución Política de los Estados Unidos Mexicanos`,
        `y la Ley de Amparo reglamentaria de los artículos 103 y 107 constitucionales.`,
        `POR TANTO, SE RESUELVE: Primero. Este tribunal es competente para conocer del asunto.`,
        `Segundo. Queda a salvo el derecho del promovente. NOTIFÍQUESE y cúmplase.`,
      ].join(' ')
    ).join('\n\n');

    const pages: OCRPageResult[] = Array.from({ length: estimatedPages }, (_, i) => {
      const start = i * Math.floor(mockText.length / estimatedPages);
      const end = (i + 1) * Math.floor(mockText.length / estimatedPages);
      const pageText = mockText.slice(start, end);
      return { page: i + 1, text: pageText, chars: pageText.length };
    });

    return {
      text: mockText,
      pages,
      confidence: 90,
      provider: this.name,
      pageCount: estimatedPages,
      durationMs: Date.now() - start,
      warnings: ['[PROVEEDOR MOCK DE PRUEBA] Configura OCR_PROVIDER=ilovepdf con credenciales reales para OCR de producción.'],
    };
  }
}

// ── iLoveAPI OCR Provider ──────────────────────────────────────────────────────

/**
 * iLoveAPI OCR provider.
 * Set OCR_PROVIDER=ilovepdf in .env.local or environment.
 *
 * Required env vars:
 *   ILOVEPDF_PUBLIC_KEY   — public key from ilovepdf.com
 *   ILOVEPDF_SECRET_KEY   — secret key (JWT signing) — NEVER expose in browser
 *   ILOVEPDF_REGION       — optional, defaults to 'api' (eu: 'api.eu')
 *
 * Flow: START → UPLOAD → PROCESS (pdfocr) → DOWNLOAD → re-extract text
 */
export class ILovePDFOCRProvider implements DocumentOCRProvider {
  readonly name = 'ilovepdf';

  private get publicKey(): string {
    return process.env.ILOVEPDF_PUBLIC_KEY || '';
  }
  private get secretKey(): string {
    return process.env.ILOVEPDF_SECRET_KEY || '';
  }
  private get region(): string {
    return process.env.ILOVEPDF_REGION || 'api';
  }

  supports(mimeType: string): boolean {
    return (
      mimeType === 'application/pdf' ||
      mimeType.startsWith('image/')
    );
  }

  isConfigured(): boolean {
    return Boolean(this.publicKey && this.secretKey);
  }

  async process(input: OCRInput): Promise<OCRResult> {
    if (!this.isConfigured()) {
      throw new Error(
        'iLoveAPI no está configurada. Agrega ILOVEPDF_PUBLIC_KEY y ILOVEPDF_SECRET_KEY a .env.local'
      );
    }

    const start = Date.now();
    const baseUrl = `https://${this.region}.ilovepdf.com/v1`;
    const lang = input.language || 'spa';
    const warnings: string[] = [];

    // ── STEP 1: START — obtain server assignment and task token ───────────────
    const startResp = await fetch(`${baseUrl}/start/pdfocr`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${await this._getJWT()}`,
      },
    });
    if (!startResp.ok) {
      throw new Error(`iLoveAPI START falló: ${startResp.status} ${startResp.statusText}`);
    }
    const startData = (await startResp.json()) as {
      server: string;
      task: string;
    };

    const { server, task } = startData;

    // ── STEP 2: UPLOAD ────────────────────────────────────────────────────────
    const uploadForm = new FormData();
    const blob = new Blob([new Uint8Array(input.buffer)], { type: input.mimeType });
    uploadForm.append('task', task);
    uploadForm.append('file', blob, input.fileName || 'documento.pdf');

    const uploadResp = await fetch(`https://${server}/v1/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this._getJWT()}`,
      },
      body: uploadForm,
    });
    if (!uploadResp.ok) {
      throw new Error(`iLoveAPI UPLOAD falló: ${uploadResp.status} ${uploadResp.statusText}`);
    }
    const uploadData = (await uploadResp.json()) as { server_filename: string };

    // ── STEP 3: PROCESS (pdfocr) ──────────────────────────────────────────────
    const processResp = await fetch(`https://${server}/v1/process`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this._getJWT()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task,
        tool: 'pdfocr',
        files: [{ server_filename: uploadData.server_filename, filename: input.fileName || 'documento.pdf' }],
        ocr_languages: [lang],
        output_filename: 'resultado-ocr',
      }),
    });
    if (!processResp.ok) {
      const errText = await processResp.text().catch(() => '');
      throw new Error(`iLoveAPI PROCESS falló: ${processResp.status} — ${errText}`);
    }

    // ── STEP 4: DOWNLOAD ──────────────────────────────────────────────────────
    const downloadResp = await fetch(`https://${server}/v1/download/${task}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${await this._getJWT()}`,
      },
    });
    if (!downloadResp.ok) {
      throw new Error(`iLoveAPI DOWNLOAD falló: ${downloadResp.status}`);
    }
    const ocrPdfBuffer = Buffer.from(await downloadResp.arrayBuffer());

    // ── STEP 5: Re-extract text from the OCR'd PDF ────────────────────────────
    let extractedText = '';
    let pageCount = 1;
    let pages: OCRPageResult[] = [];

    try {
      const { extractPdfTextServer } = await import('./pdfExtractor');
      const result = await extractPdfTextServer(ocrPdfBuffer);
      extractedText = result.text;
      pageCount = result.numpages;
      pages = result.pages.map((p) => ({
        page: p.pageNumber,
        text: p.text,
        chars: p.text.length,
      }));
    } catch (err: any) {
      warnings.push(`Re-extracción post-OCR falló: ${err.message}`);
    }

    return {
      text: extractedText,
      pages,
      confidence: extractedText.length > 1000 ? 92 : 55,
      provider: this.name,
      pageCount,
      durationMs: Date.now() - start,
      warnings,
    };
  }

  /**
   * Generate a short-lived JWT for iLoveAPI authentication.
   * Uses HS256 with the secret key. Never exposes the secret key externally.
   */
  private async _getJWT(): Promise<string> {
    // Build minimal JWT manually to avoid adding a dependency.
    // Header and payload are base64url-encoded, signature is HMAC-SHA256.
    const header = this._b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = this._b64url(
      JSON.stringify({
        iss: this.publicKey,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    );
    const unsigned = `${header}.${payload}`;
    const signature = await this._hmacSha256(this.secretKey, unsigned);
    return `${unsigned}.${signature}`;
  }

  private _b64url(str: string): string {
    return Buffer.from(str, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private async _hmacSha256(secret: string, data: string): Promise<string> {
    const { createHmac } = await import('crypto');
    return createHmac('sha256', secret)
      .update(data)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

// ── Tesseract Local OCR Provider ───────────────────────────────────────────────

/**
 * Local Tesseract.js provider for image files.
 * Set OCR_PROVIDER=tesseract (or leave unset when ILOVEPDF keys are absent).
 * Works without any external API calls.
 * Note: Only supports images (JPEG/PNG), not PDFs.
 */
export class TesseractOCRProvider implements DocumentOCRProvider {
  readonly name = 'tesseract';

  supports(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  async process(input: OCRInput): Promise<OCRResult> {
    const start = Date.now();
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.default.createWorker(input.language || 'spa');
    let text = '';
    let confidence = 0;
    const warnings: string[] = [];

    try {
      const result = await worker.recognize(input.buffer);
      text = result.data.text || '';
      confidence = Math.round(result.data.confidence || 0);
    } catch (err: any) {
      warnings.push(`Tesseract error: ${err.message}`);
    } finally {
      await worker.terminate().catch(() => {});
    }

    const pageText = text.trim();
    return {
      text: pageText,
      pages: [{ page: 1, text: pageText, chars: pageText.length }],
      confidence,
      provider: this.name,
      pageCount: 1,
      durationMs: Date.now() - start,
      warnings,
    };
  }
}

// ── Provider Registry ──────────────────────────────────────────────────────────

/**
 * Returns the active OCR provider based on the OCR_PROVIDER environment variable.
 *
 * Supported values:
 *   mock      → MockOCRProvider (default for development / CI)
 *   ilovepdf  → ILovePDFOCRProvider (production, requires API keys)
 *   tesseract → TesseractOCRProvider (local, images only)
 *
 * Production deployments should set OCR_PROVIDER=ilovepdf plus the
 * ILOVEPDF_PUBLIC_KEY and ILOVEPDF_SECRET_KEY env vars.
 */
export function getOCRProvider(): DocumentOCRProvider {
  const provider = (process.env.OCR_PROVIDER || 'mock').toLowerCase();

  switch (provider) {
    case 'ilovepdf':
      return new ILovePDFOCRProvider();
    case 'tesseract':
      return new TesseractOCRProvider();
    case 'mock':
    default:
      return new MockOCRProvider();
  }
}

/**
 * True when any configured OCR provider is available for the given mimeType.
 * Checks both environment flag and provider capability.
 */
export function ocrAvailable(mimeType: string): boolean {
  if (process.env.OCR_ENABLED === 'false') return false;
  const provider = getOCRProvider();
  if (provider.name === 'ilovepdf') {
    return (provider as ILovePDFOCRProvider).isConfigured() && provider.supports(mimeType);
  }
  return provider.supports(mimeType);
}
