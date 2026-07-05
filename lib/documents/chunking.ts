export type Chunk = {
  text: string;
  chunkIndex: number;
};

/**
 * Splits text into chunks of approximately maxChars length,
 * trying to break at paragraphs or sentences to avoid cutting words.
 */
export function chunkText(text: string, maxChars: number = 1000): Chunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // To prevent memory explosion on huge documents, hard limit the overall length processed
  const MAX_DOCUMENT_LENGTH = 500_000; 
  let contentToProcess = text;
  if (contentToProcess.length > MAX_DOCUMENT_LENGTH) {
    console.warn(`Document too large (${contentToProcess.length} chars). Truncating to ${MAX_DOCUMENT_LENGTH} chars.`);
    contentToProcess = contentToProcess.substring(0, MAX_DOCUMENT_LENGTH);
  }

  const chunks: Chunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;

  // Split by double newline (paragraphs)
  const paragraphs = contentToProcess.split(/\n\s*\n/);

  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;

    // If a single paragraph is larger than maxChars, we should split it by sentences
    if (trimmed.length > maxChars) {
      const sentences = trimmed.match(/[^.!?]+[.!?]+[\])'"`’”]*|.+/g) || [trimmed];
      
      for (const sentence of sentences) {
        const s = sentence.trim();
        if (!s) continue;

        if (currentChunk.length + s.length > maxChars && currentChunk.length > 0) {
          chunks.push({ text: currentChunk.trim(), chunkIndex: chunkIndex++ });
          currentChunk = s;
        } else {
          currentChunk = currentChunk ? `${currentChunk} ${s}` : s;
        }
      }
    } else {
      if (currentChunk.length + trimmed.length > maxChars && currentChunk.length > 0) {
        chunks.push({ text: currentChunk.trim(), chunkIndex: chunkIndex++ });
        currentChunk = trimmed;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push({ text: currentChunk.trim(), chunkIndex: chunkIndex++ });
  }

  return chunks;
}
