/**
 * Pure utility function to normalize judicial expediente strings according to verified source formats.
 *
 * Supported formats:
 * - TJA Jalisco / CJJ Jalisco / Standard MX: "1234/2024"
 * - Converts 2-digit year "1234/24" -> "1234/2024"
 * - Strips prefixes like "Exp.", "Expediente", "EXP", "No."
 * - Handles separators like "/", "-", spaces ("1234-2024", "1234 2024")
 *
 * Returns null if the input format is unrecognized or invalid for the given source.
 */

export type SourceSlug = 'TJA_JALISCO' | 'boletin_judicial_jalisco' | 'cjj' | string;

const KNOWN_PREFIXES_REGEX = /^(expediente|exp\.?|no\.?|num\.?|nro\.?)\s*/i;

export function normalizeExpediente(input: string | null | undefined, fuente?: SourceSlug): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // 1. Basic sanitization: strip zero-width characters, NFKC normalize, trim
  let clean = input
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  if (!clean) return null;

  // 2. Strip common prefixes like "Exp. ", "Expediente ", "No. "
  clean = clean.replace(KNOWN_PREFIXES_REGEX, '').trim();

  // 3. Match serial number and year
  // Pattern: (1 to 6 digits serial) [separator / | - | space] (2 or 4 digits year)
  const match = clean.match(/^(\d{1,6})\s*[\/\-\s]\s*(\d{2}|\d{4})$/);
  if (!match) {
    return null;
  }

  const [, rawSerial, rawYear] = match;

  // Strip leading zeros for serial, keeping at least one digit (e.g., "001234" -> "1234")
  const serial = String(parseInt(rawSerial, 10));
  if (serial === 'NaN' || serial === '0') {
    // Serial number 0 is invalid
    return null;
  }

  // Parse year
  let year: number;
  if (rawYear.length === 2) {
    const yr2 = parseInt(rawYear, 10);
    // 00..30 -> 2000..2030; 70..99 -> 1970..1999
    year = yr2 <= 35 ? 2000 + yr2 : 1900 + yr2;
  } else {
    year = parseInt(rawYear, 10);
  }

  // Validate realistic year bounds (1950 to current year + 1)
  const currentYear = new Date().getFullYear();
  if (year < 1950 || year > currentYear + 1) {
    return null;
  }

  // Source-specific formatting rules
  if (fuente) {
    const slug = fuente.toLowerCase();
    if (slug.includes('tja') || slug.includes('jalisco') || slug.includes('cjj')) {
      // TJA Jalisco standard pattern: NNNN/AAAA
      return `${serial}/${year}`;
    }
  }

  // Generic fallback format: NNNN/AAAA
  return `${serial}/${year}`;
}
