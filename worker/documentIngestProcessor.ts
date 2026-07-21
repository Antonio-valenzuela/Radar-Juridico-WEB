// worker/documentIngestProcessor.ts

import { Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import {
  updateIngestionJobStatus,
  logIngestionEvent,
  markJobRetrying,
  moveJobToDeadLetter,
  completeIngestionJob,
  IngestionStatus,
} from '@/lib/ingestion/ingestionJob';
import {
  fetchPinnedPublicHttpUrl,
  normalizeUserAgent,
  readResponseBodyWithLimit,
  validateRedirectTarget,
  validateUrlSecurity,
} from '@/lib/security/urlValidation';
import { createOrUpdateDocumentVersion } from '@/lib/documents/versionControl';
import { indexDocumentVersion } from '@/lib/documents/indexDocument';
import { analyzeLegalDocumentWithProvider } from '@/lib/ai/provider';
import * as cheerio from 'cheerio';

export async function processDocumentIngestion(job: Job) {
  const { source, documentUrl, ingestionJobId } = job.data;

  if (!ingestionJobId) {
    throw new Error('ingestionJobId es requerido en el payload del job');
  }

  try {
    // 1. Validar seguridad
    await logIngestionEvent(ingestionJobId, 'Validando seguridad de la URL');
    const safety = await validateUrlSecurity(documentUrl);
    if (!safety.valid) {
      await updateIngestionJobStatus(ingestionJobId, IngestionStatus.FALLIDO, safety.error);
      await logIngestionEvent(ingestionJobId, `Seguridad: ${safety.error}`, 'ERROR');
      throw new Error(safety.error);
    }

    // 2. DESCARGANDO
    await updateIngestionJobStatus(ingestionJobId, IngestionStatus.DESCARGANDO);
    await logIngestionEvent(ingestionJobId, 'Iniciando descarga del documento');

    const timeout = safety.timeout || 30000;
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeout);

    const headers = {
      'User-Agent': normalizeUserAgent(),
      'Accept': 'application/pdf,text/html,text/plain,*/*'
    };

    let response: Response | undefined;
    let contentType = '';
    let buffer: Buffer;
    let currentUrl = documentUrl;
    try {
      for (let redirectCount = 0; redirectCount <= 5; redirectCount++) {
        response = await fetchPinnedPublicHttpUrl(currentUrl, {
          headers,
          signal: controller.signal,
          redirect: 'manual',
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;

        const redirect = validateRedirectTarget(currentUrl, response.headers.get('location'));
        if (!redirect.ok) throw new Error(`Redirección bloqueada: ${redirect.reason}`);
        currentUrl = redirect.url;
        response = undefined;
      }

      if (!response) throw new Error('Demasiadas redirecciones al descargar el documento');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      contentType = (response.headers.get('content-type') || '').toLowerCase();
      const responseBody = await readResponseBodyWithLimit(response, 20 * 1024 * 1024);
      buffer = Buffer.from(responseBody);
    } catch (err: any) {
      throw new Error(`Fallo de conexión o timeout al descargar: ${err.message}`);
    } finally {
      clearTimeout(timerId);
    }
    await logIngestionEvent(ingestionJobId, `Descarga completa: ${buffer.byteLength} bytes. Content-Type: ${contentType}`);

    // 3. EXTRAYENDO_TEXTO
    await updateIngestionJobStatus(ingestionJobId, IngestionStatus.EXTRAYENDO_TEXTO);
    await logIngestionEvent(ingestionJobId, 'Iniciando extracción de texto');

    let text = '';
    const isPdf = contentType.includes('pdf') || /\.pdf($|\?)/i.test(documentUrl);

    if (isPdf) {
      try {
        const mod = await import('pdf-parse');
        const pdfParse = ('default' in mod ? mod.default : mod) as unknown as (
          input: Buffer
        ) => Promise<{ text?: string }>;
        const parsed = await pdfParse(buffer);
        text = parsed.text || '';
      } catch (err: any) {
        throw new Error(`Error parseando PDF: ${err.message}`);
      }
    } else {
      const htmlText = buffer.toString('utf8');
      if (contentType.includes('html') || /<html|<body|<div/i.test(htmlText)) {
        const $ = cheerio.load(htmlText);
        $('script,style,noscript,nav,header,footer,iframe,svg').remove();
        text = $('main').text() || $('body').text() || '';
      } else {
        text = htmlText;
      }
    }

    text = text.trim();
    if (text.length < 10) {
      throw new Error('El texto extraído es demasiado corto o vacío');
    }
    await logIngestionEvent(ingestionJobId, `Extracción completa: ${text.length} caracteres extraídos`);

    // 4. GENERANDO_EMBEDDINGS
    await updateIngestionJobStatus(ingestionJobId, IngestionStatus.GENERANDO_EMBEDDINGS);
    await logIngestionEvent(ingestionJobId, 'Buscando o creando registro de Documento');

    // Buscar o crear Document
    let document = await prisma.document.findUnique({
      where: { canonicalKey: documentUrl }
    });

    if (!document) {
      // Intentar limpiar un título descriptivo
      let docTitle = `Documento legal - ${source}`;
      if (!isPdf) {
        const $ = cheerio.load(buffer.toString('utf8'));
        const htmlTitle = $('title').text().trim();
        if (htmlTitle) docTitle = htmlTitle;
      }

      document = await prisma.document.create({
        data: {
          source,
          documentType: isPdf ? 'pdf' : 'html',
          title: docTitle,
          canonicalKey: documentUrl,
          canonicalUrl: documentUrl,
          status: 'active',
        }
      });
    }

    await logIngestionEvent(ingestionJobId, `Registrando DocumentVersion para Document: ${document.id}`);
    const { version, isNew, documentVersionId } = await createOrUpdateDocumentVersion(document.id, text);
    await logIngestionEvent(ingestionJobId, `Versión registrada: V${version}. Nueva versión: ${isNew}`);

    await logIngestionEvent(ingestionJobId, `Indexando y generando embeddings para chunks de DocumentVersion: ${documentVersionId}`);
    const indexResult = await indexDocumentVersion(documentVersionId);
    await logIngestionEvent(
      ingestionJobId,
      `Indexación de embeddings completada: ${indexResult.chunks} chunks creados. Omitidos: ${indexResult.skipped}`
    );

    // 5. CLASIFICANDO_CON_IA
    await updateIngestionJobStatus(ingestionJobId, IngestionStatus.CLASIFICANDO_CON_IA);
    await logIngestionEvent(ingestionJobId, 'Iniciando clasificación y enriquecimiento con IA');

    try {
      const { provider, analysis } = await analyzeLegalDocumentWithProvider({
        title: document.title,
        summary: document.summary || '',
        text: text.slice(0, 5000), // límite para evitar rebasar tokens en análisis básico
        sourceUrl: documentUrl,
        publishedAt: new Date(),
      });

      // Actualizar el resumen e info en el documento raíz
      await prisma.document.update({
        where: { id: document.id },
        data: {
          summary: analysis.summary || document.summary,
          hasVersions: true,
          latestVersionHash: generateContentHash(text),
        }
      });

      // Si existe un Item asociado, podemos enlazarlo
      await logIngestionEvent(ingestionJobId, `Clasificación IA completa (${provider}): Materia: ${analysis.matter}, Impacto: ${analysis.impactLevel}`);
    } catch (iaErr: any) {
      // No fallar todo el job si solo falla el análisis IA (usar fallback de logging)
      await logIngestionEvent(ingestionJobId, `Advertencia: Falló clasificación IA: ${iaErr.message}. Continuando...`, 'WARN');
    }

    // 6. COMPLETADO
    await completeIngestionJob(ingestionJobId, document.id);
    await logIngestionEvent(ingestionJobId, 'Procesamiento e ingesta completados exitosamente');

    // Desencadenar la evaluación de alertas de manera asíncrona para no bloquear
    import('@/lib/alerts/evaluateAlerts')
      .then(({ evaluateAlertsForDocument }) => evaluateAlertsForDocument(document.id))
      .catch((err) => console.error('Error al evaluar alertas:', err));

    return { success: true, documentId: document.id };
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (job.attemptsMade + 1 < (job.opts.attempts || 5)) {
      // Reintentar
      await markJobRetrying(ingestionJobId, job.attemptsMade + 1);
      await logIngestionEvent(
        ingestionJobId,
        `Error durante el procesamiento (intento ${job.attemptsMade + 1}/${job.opts.attempts || 5}): ${errorMsg}`,
        'WARN'
      );
      throw error;
    } else {
      // Dead letter
      await moveJobToDeadLetter(ingestionJobId, errorMsg);
      await logIngestionEvent(
        ingestionJobId,
        `Movido a Dead Letter Queue después de ${job.attemptsMade + 1} intentos. Error final: ${errorMsg}`,
        'ERROR'
      );
      throw error;
    }
  }
}

function generateContentHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}
