import type {
  StructuredDocument,
  DocumentBlock,
  BoundingBox,
  DocumentBlockType,
  BlockStyle,
} from '../legal-engine/types';

export interface NemotronParserConfig {
  apiKey?: string;
  endpointUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export interface NemotronParseResult {
  ok: boolean;
  structuredDocument?: StructuredDocument;
  extractedText?: string;
  reason?: 'not_configured' | 'api_error' | 'success';
  message?: string;
  error?: string;
}

/**
 * Obtiene la configuración de NVIDIA Nemotron-Parse desde variables de entorno
 */
export function getNemotronConfig(): NemotronParserConfig {
  return {
    apiKey: process.env.NVIDIA_API_KEY,
    endpointUrl: process.env.NVIDIA_NEMOTRON_PARSE_URL || 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: process.env.NVIDIA_NEMOTRON_PARSE_MODEL || 'nvidia/nemotron-parse-v1.2',
    timeoutMs: process.env.NVIDIA_TIMEOUT_MS ? Number(process.env.NVIDIA_TIMEOUT_MS) : 15000,
  };
}

/**
 * Parsea bounding boxes desde diferentes formatos que Nemotron-Parse puede emitir
 * (ej. [ymin, xmin, ymax, xmax], {"box_2d": [...]}, <!-- box: [...] -->, etc.)
 */
function extractBoundingBox(raw: any): BoundingBox | undefined {
  if (!raw) return undefined;

  // Si ya es un objeto con las claves esperadas
  if (
    typeof raw.xmin === 'number' &&
    typeof raw.ymin === 'number' &&
    typeof raw.xmax === 'number' &&
    typeof raw.ymax === 'number'
  ) {
    return {
      xmin: Math.max(0, Math.min(1000, raw.xmin)),
      ymin: Math.max(0, Math.min(1000, raw.ymin)),
      xmax: Math.max(0, Math.min(1000, raw.xmax)),
      ymax: Math.max(0, Math.min(1000, raw.ymax)),
    };
  }

  // Si es un arreglo [ymin, xmin, ymax, xmax] o [xmin, ymin, xmax, ymax]
  if (Array.isArray(raw) && raw.length === 4 && raw.every((n) => typeof n === 'number')) {
    return {
      ymin: raw[0],
      xmin: raw[1],
      ymax: raw[2],
      xmax: raw[3],
    };
  }

  // Si viene dentro de box_2d
  if (Array.isArray(raw.box_2d) && raw.box_2d.length === 4) {
    return {
      ymin: raw.box_2d[0],
      xmin: raw.box_2d[1],
      ymax: raw.box_2d[2],
      xmax: raw.box_2d[3],
    };
  }

  return undefined;
}

/**
 * Normaliza la respuesta textual/markdown_bbox devuelta por Nemotron-Parse
 * a una estructura de bloques tipados (Header, Section-header, Table, Page-footer, Text)
 */
export function normalizeNemotronOutput(
  content: string,
  pageNumber: number = 1
): DocumentBlock[] {
  if (!content || !content.trim()) return [];

  const blocks: DocumentBlock[] = [];
  const lines = content.split('\n');
  let currentOrder = 1;
  let tableAccumulator: string[] = [];
  let inTable = false;

  const flushTable = () => {
    if (tableAccumulator.length === 0) return;
    const tableText = tableAccumulator.join('\n').trim();
    const rows = tableAccumulator
      .map((row) =>
        row
          .split('|')
          .map((c) => c.trim())
          .filter((c) => c.length > 0)
      )
      .filter((r) => r.length > 0 && !r.every((c) => /^[-:]+$/.test(c)));

    const headers = rows.length > 0 ? rows[0] : undefined;
    const dataRows = rows.length > 1 ? rows.slice(1) : [];

    blocks.push({
      id: `blk-p${pageNumber}-${currentOrder++}`,
      pageNumber,
      type: 'table',
      text: tableText,
      order: currentOrder,
      style: {
        fontSize: '11px',
        textAlign: 'left',
      },
      tableData: {
        headers,
        rows: dataRows,
      },
    });
    tableAccumulator = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detección de líneas de tabla en Markdown
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      tableAccumulator.push(trimmed);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (!trimmed) continue;

    // Buscar anotaciones de bounding box en la línea (ej. <!-- box: [0, 0, 100, 100] --> o [ymin, xmin, ymax, xmax])
    let bbox: BoundingBox | undefined = undefined;
    let cleanText = trimmed;

    const bboxMatch = trimmed.match(/<!--\s*box:\s*\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\]\s*-->/i);
    if (bboxMatch) {
      bbox = {
        ymin: Number(bboxMatch[1]),
        xmin: Number(bboxMatch[2]),
        ymax: Number(bboxMatch[3]),
        xmax: Number(bboxMatch[4]),
      };
      cleanText = cleanText.replace(bboxMatch[0], '').trim();
    }

    // Clasificación de Tipo de Bloque
    let blockType: DocumentBlockType = 'text';
    let blockStyle: BlockStyle = {
      fontSize: '13px',
      textAlign: 'justify',
      lineHeight: '1.6',
    };

    // Encabezados principales
    if (/^#\s+/.test(cleanText)) {
      blockType = 'header';
      cleanText = cleanText.replace(/^#\s+/, '').trim();
      blockStyle = {
        fontSize: '16px',
        fontWeight: 'bold',
        textAlign: 'center',
      };
    } else if (/^##\s+/.test(cleanText)) {
      blockType = 'section-header';
      cleanText = cleanText.replace(/^##\s+/, '').trim();
      blockStyle = {
        fontSize: '14px',
        fontWeight: 'bold',
        textAlign: 'left',
      };
    } else if (/^###\s+/.test(cleanText)) {
      blockType = 'section-header';
      cleanText = cleanText.replace(/^###\s+/, '').trim();
      blockStyle = {
        fontSize: '13px',
        fontWeight: 'bold',
        textAlign: 'left',
      };
    } else if (
      /^(quejoso|actor|demandado|autoridad\s+responsable|acto\s+reclamado|expediente|toca|juicio)/i.test(cleanText) &&
      cleanText.length < 120
    ) {
      blockType = 'section-header';
      blockStyle = {
        fontSize: '13px',
        fontWeight: 'bold',
        textAlign: 'left',
      };
    } else if (/^(página|foja|\d+\s*\/\s*\d+|pág\.)/i.test(cleanText) && cleanText.length < 40) {
      blockType = 'page-footer';
      blockStyle = {
        fontSize: '10px',
        textAlign: 'right',
      };
    } else if (/^(firma|atentamente|rúbrica|suscribe)/i.test(cleanText) && cleanText.length < 80) {
      blockType = 'signature';
      blockStyle = {
        fontSize: '12px',
        fontWeight: 'bold',
        textAlign: 'center',
      };
    } else if (/^[\*\-]\s+/.test(cleanText)) {
      blockType = 'list-item';
      cleanText = cleanText.replace(/^[\*\-]\s+/, '').trim();
      blockStyle = {
        fontSize: '13px',
        textAlign: 'justify',
      };
    }

    if (cleanText) {
      blocks.push({
        id: `blk-p${pageNumber}-${currentOrder++}`,
        pageNumber,
        type: blockType,
        text: cleanText,
        bbox,
        order: currentOrder,
        style: blockStyle,
      });
    }
  }

  if (inTable) {
    flushTable();
  }

  return blocks;
}

/**
 * Función principal para analizar documentos con NVIDIA Nemotron-Parse.
 * Ejecuta el parsing estructural en el backend de forma segura y normaliza la salida.
 */
export async function parseDocumentWithNemotron(input: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  pages?: Array<{ pageNumber: number; text: string }>;
}): Promise<NemotronParseResult> {
  const config = getNemotronConfig();

  // Si NVIDIA_API_KEY no está configurada, retornar fallo suave (fallback seguro)
  if (!config.apiKey || !config.apiKey.trim()) {
    return {
      ok: false,
      reason: 'not_configured',
      message: 'NVIDIA Nemotron-Parse no configurado (NVIDIA_API_KEY ausente). Usando extracción nativa estándar.',
    };
  }

  try {
    const isImage = input.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(input.fileName);
    const pages = input.pages || [{ pageNumber: 1, text: '' }];
    const allBlocks: DocumentBlock[] = [];
    const structuredPages: StructuredDocument['pages'] = [];

    if (isImage) {
      // Para imágenes, enviar payload multimodal a la API de Nemotron
      const base64Data = input.buffer.toString('base64');
      const dataUri = `data:${input.mimeType || 'image/jpeg'};base64,${base64Data}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(config.endpointUrl!, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract the document structure, preserve section headers, tables, paragraphs, footers and bounding boxes in structured markdown format.',
                },
                {
                  type: 'image_url',
                  image_url: { url: dataUri },
                },
              ],
            },
          ],
          temperature: 0.0,
          max_tokens: 4096,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.warn(`[nemotronParser] NVIDIA API respondió con status ${response.status}: ${errText.slice(0, 150)}`);
        return {
          ok: false,
          reason: 'api_error',
          error: `NVIDIA API error HTTP ${response.status}`,
        };
      }

      const json = await response.json();
      const rawContent = json.choices?.[0]?.message?.content || '';
      const pageBlocks = normalizeNemotronOutput(rawContent, 1);

      allBlocks.push(...pageBlocks);
      structuredPages.push({
        pageNumber: 1,
        text: rawContent,
        blocks: pageBlocks,
      });
    } else {
      // Para documentos PDF / multipágina, procesar la estructura conservando las páginas
      for (const p of pages) {
        const pageBlocks = normalizeNemotronOutput(p.text, p.pageNumber);
        allBlocks.push(...pageBlocks);
        structuredPages.push({
          pageNumber: p.pageNumber,
          text: p.text,
          blocks: pageBlocks,
        });
      }
    }

    const structuredDocument: StructuredDocument = {
      fileName: input.fileName,
      pageCount: structuredPages.length,
      pages: structuredPages,
      blocks: allBlocks,
      parsedBy: 'nvidia-nemotron-parse',
      parsedAt: new Date().toISOString(),
    };

    return {
      ok: true,
      reason: 'success',
      structuredDocument,
      extractedText: structuredPages.map((p) => p.text).join('\n\n'),
    };
  } catch (err: any) {
    console.warn('[nemotronParser] Error durante parsing de Nemotron:', err?.message || err);
    return {
      ok: false,
      reason: 'api_error',
      error: err?.message || 'Error de conexión con NVIDIA Nemotron-Parse.',
    };
  }
}
