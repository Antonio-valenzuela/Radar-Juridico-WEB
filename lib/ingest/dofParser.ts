import { extractLegalContentFromHtml, type ExtractedManualContent } from "@/lib/ingest/manualUrl";

export type ParsedDofNote = ExtractedManualContent;

export function parseDofNote(html: string, url: string): ParsedDofNote {
  return extractLegalContentFromHtml(html, url);
}
