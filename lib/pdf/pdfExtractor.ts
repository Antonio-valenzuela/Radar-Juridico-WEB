import Tesseract from 'tesseract.js';

export interface ExtractedPdfContent {
  text: string;
  numpages: number;
  info?: any;
  needsOcr: boolean;
  pages: Array<{ pageNumber: number; text: string }>;
}

export async function extractPdfTextServer(buffer: Buffer): Promise<ExtractedPdfContent> {
  if (!buffer || buffer.length === 0) {
    throw new Error("El archivo PDF está vacío o corrupto.");
  }

  // Maximum size 15MB check
  if (buffer.length > 15 * 1024 * 1024) {
    throw new Error("El archivo excede el tamaño máximo permitido de 15MB.");
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    const totalText = (data.text || "").trim();
    const numpages = data.numpages || 1;

    // Split text across estimated pages if page-by-page text isn't directly separated
    const pageChunks = totalText.split(/\f|\n(?=Página \d+)/i);
    const pages = Array.from({ length: numpages }, (_, i) => {
      const pageText = (pageChunks[i] || totalText).trim();
      return {
        pageNumber: i + 1,
        text: pageText,
      };
    });

    const averageCharsPerPage = totalText.length / Math.max(1, numpages);
    const needsOcr = averageCharsPerPage < 80;

    return {
      text: totalText,
      numpages,
      info: data.info,
      needsOcr,
      pages,
    };
  } catch (err: any) {
    throw new Error(`Error al procesar el archivo PDF: ${err.message || "Archivo no válido o protegido"}`);
  }
}

export const OCR_MAX_PAGES = 20;

export function ocrEnabled(): boolean {
  return process.env.OCR_ENABLED !== 'false';
}

export async function extractPdfTextWithOCR(buffer: Buffer): Promise<ExtractedPdfContent> {
  const result = await extractPdfTextServer(buffer);
  if (result.needsOcr && ocrEnabled()) {
    // We can't convert easily PDF to image server-side without native deps,
    // so we return the flag. Actual OCR of raw buffer happens with image files.
  }
  return result;
}

export async function extractImageTextOCR(buffer: Buffer, mimeType: string): Promise<{text: string, confidence: number}> {
  if (!ocrEnabled()) {
    return { text: '', confidence: 0 };
  }
  const worker = await Tesseract.createWorker('spa');
  const { data: { text, confidence } } = await worker.recognize(buffer);
  await worker.terminate();
  return { text, confidence };
}
