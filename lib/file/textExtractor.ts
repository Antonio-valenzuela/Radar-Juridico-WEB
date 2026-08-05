import { ExtractedPdfContent, extractPdfTextServer } from '@/lib/pdf/pdfExtractor';

export interface ExtractedTextResult {
  text: string;
  fileName: string;
  mimeType: string;
  needsOcr: boolean;
  pages?: Array<{ pageNumber: number; text: string }>;
}

export async function extractTextFromFile(file: File): Promise<ExtractedTextResult> {
  const { name, type } = file;
  const extension = name.split('.').pop()?.toLowerCase() || '';
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (extension === 'pdf' || type === 'application/pdf') {
    const pdfResult = await extractPdfTextServer(buffer);
    return {
      text: pdfResult.text,
      fileName: name,
      mimeType: 'application/pdf',
      needsOcr: pdfResult.needsOcr,
      pages: pdfResult.pages,
    };
  }

  if (extension === 'docx' || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value.trim(),
      fileName: name,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      needsOcr: false,
    };
  }

  if (extension === 'txt' || type === 'text/plain') {
    return {
      text: buffer.toString('utf8').trim(),
      fileName: name,
      mimeType: 'text/plain',
      needsOcr: false,
    };
  }

  throw new Error('Formato de archivo no compatible. Usa PDF, DOCX o TXT.');
}
