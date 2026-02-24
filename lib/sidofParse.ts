export function cleanText(s: string) {
  return (s || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
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

export function extractTitleFromHtml(html: string) {
  // 1) og:title
  const og = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (og) return cleanText(og);

  // 2) h1
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return stripHtml(h1);

  // 3) title
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (title) return cleanText(title);

  return "";
}

export function extractSummaryFromHtml(html: string) {
  // meta description primero
  const desc = html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (desc) return cleanText(desc).slice(0, 400);

  const text = stripHtml(html);
  return text.slice(0, 400);
}

export function isBadGenericSidofTitle(title: string) {
  const t = title.toLowerCase();
  return (
    !t ||
    t.includes("bienvenido al sistema") ||
    t.includes("diario oficial de la federación") ||
    t.includes("poder ejecutivo") ||
    t.includes("poder judicial") ||
    t.includes("organos autonomos") ||
    t.includes("indice de imagenes") ||
    t.includes("página principal") ||
    t.includes("secretaría de") && t.length < 25 || // Ej: "Secretaría de Salud" solo es muy genérico si no hay más
    t.length < 10
  );
}
