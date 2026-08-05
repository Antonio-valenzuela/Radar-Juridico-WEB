import crypto from 'crypto';
import { prisma } from '../prisma';

export interface IndexLegalTemplateResult {
  ok: boolean;
  templateId: string;
  chunksIndexed: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Stub de indexación RAG para LegalTemplate.
 * En esta fase solo actualiza el contentHash para detección de cambios futuros.
 * La indexación completa (chunking → embeddings → pgvector) se implementará
 * cuando NVIDIA_API_KEY y los workers estén activos en producción.
 */
export async function indexLegalTemplate(
  templateId: string
): Promise<IndexLegalTemplateResult> {
  try {
    const template = await prisma.legalTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, title: true, content: true, originalText: true, contentHash: true },
    });

    if (!template) {
      return { ok: false, templateId, chunksIndexed: 0, skipped: true, reason: 'not_found' };
    }

    const text = [template.title, template.content, template.originalText]
      .filter(Boolean)
      .join('\n\n');

    if (!text.trim()) {
      return { ok: true, templateId, chunksIndexed: 0, skipped: true, reason: 'no_content' };
    }

    const newHash = crypto.createHash('sha256').update(text).digest('hex');

    if (template.contentHash === newHash) {
      return { ok: true, templateId, chunksIndexed: 0, skipped: true, reason: 'unchanged' };
    }

    // Solo actualizar el hash — la indexación RAG se activa en la Fase de NVIDIA
    await prisma.legalTemplate.update({
      where: { id: templateId },
      data: { contentHash: newHash },
    });

    return { ok: true, templateId, chunksIndexed: 0, skipped: true, reason: 'rag_pending' };
  } catch (err) {
    console.error('[indexLegalTemplate] Error:', err);
    return { ok: false, templateId, chunksIndexed: 0, skipped: true, reason: 'error' };
  }
}
