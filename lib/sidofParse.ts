function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function cleanText(s: string) {
  return (s || "")
    .replace(/\s+/g, " ")
    .replace(/ /g, " ")
    .trim();
}

export function stripHtml(html: string) {
  return cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

export function isBadGenericSidofTitle(title: string): boolean {
  const t = removeDiacritics((title || "").toLowerCase()).trim();
  return (
    !t ||
    t.length < 10 ||
    t.includes("bienvenido al sistema") ||
    t.includes("diario oficial de la federacion") ||
    t.includes("poder ejecutivo") ||
    t.includes("poder judicial") ||
    t.includes("organos autonomos") ||
    t.includes("indice de imagenes") ||
    t.includes("pagina principal") ||
    t === "dof" ||
    t === "sidof" ||
    (t.includes("secretaria de") && t.length < 25)
  );
}

/**
 * Extracts the real document title from SIDOF/DOF HTML pages.
 * Priority: og:title → h1 (non-generic) → h2 (non-generic)
 * Deliberately skips <title> tag because SIDOF uses "Bienvenido al Sistema..."
 */
export function extractTitleFromHtml(html: string): string {
  // 1) og:title (both attribute orderings)
  const ogA =
    html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1];
  if (ogA) {
    const t = cleanText(ogA);
    if (t && !isBadGenericSidofTitle(t)) return t;
  }

  // 2) All h1 tags – pick first non-generic, length > 10
  const h1Iter = html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
  for (const m of h1Iter) {
    const t = stripHtml(m[1]).trim();
    if (t && t.length > 10 && !isBadGenericSidofTitle(t)) return t;
  }

  // 3) First h2 as fallback
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1];
  if (h2) {
    const t = stripHtml(h2).trim();
    if (t && t.length > 10 && !isBadGenericSidofTitle(t)) return t;
  }

  // 4) Elements with class/id containing "titulo" or "title"
  const tiuloEl = html.match(/(?:class|id)=["'][^"']*titul[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1];
  if (tiuloEl) {
    const t = stripHtml(tiuloEl).trim();
    if (t && t.length > 10 && !isBadGenericSidofTitle(t)) return t;
  }

  // Intentionally skip <title> tag – always generic on SIDOF
  return "";
}

export function extractSummaryFromHtml(html: string): string {
  // meta description first
  const desc =
    html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
    html.match(/content=["']([^"']+)["'][^>]*name=["']description["']/i)?.[1];
  if (desc) return cleanText(desc).slice(0, 400);

  return stripHtml(html).slice(0, 400);
}
