import { cleanText } from "@/lib/ingest/normalize";

export type ArticleBlock = {
  id: string;
  title: string;
  text: string;
};

const ARTICLE_PATTERN =
  /(?:^|\s)(ART[IÍ]CULO|Articulo|Art\.?)\s+([0-9]+(?:\s*(?:Bis|Ter|Qu[aá]ter|Quinquies|Sexties|Septies|Octies|Nonies|Decies))?(?:[-\s][A-Z])?|[A-Z]+)\.?\s*/gi;

export function splitLegalText(text: string): ArticleBlock[] {
  const normalized = cleanText(text);
  const matches = [...normalized.matchAll(ARTICLE_PATTERN)];
  if (matches.length < 2) return splitBySections(normalized);

  const blocks: ArticleBlock[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index || 0;
    const end = matches[i + 1]?.index ?? normalized.length;
    const raw = normalized.slice(start, end).trim();
    const id = normalizeArticleId(match[2] || String(i + 1));
    blocks.push({
      id,
      title: `Articulo ${id}`,
      text: raw,
    });
  }
  return blocks;
}

function splitBySections(text: string): ArticleBlock[] {
  const chunks = text.split(/\s+(?=(CAP[IÍ]TULO|T[IÍ]TULO|SECCI[OÓ]N)\s+[A-Z0-9]+)/gi);
  if (chunks.length < 3) return [{ id: "documento", title: "Documento completo", text }];

  const blocks: ArticleBlock[] = [];
  for (let i = 0; i < chunks.length; i += 2) {
    const title = cleanText(`${chunks[i] || ""} ${chunks[i + 1] || ""}`).slice(0, 80);
    const body = cleanText(`${chunks[i] || ""} ${chunks[i + 1] || ""}`);
    if (!body) continue;
    blocks.push({ id: `seccion-${blocks.length + 1}`, title: title || `Seccion ${blocks.length + 1}`, text: body });
  }
  return blocks.length ? blocks : [{ id: "documento", title: "Documento completo", text }];
}

function normalizeArticleId(value: string) {
  return cleanText(value)
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .toLowerCase();
}
