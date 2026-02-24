/**
 * lib/textNormalizer.ts
 * Normalize and sanitize text for consistent hashing and comparison.
 */

/**
 * Remove invisible characters, normalize whitespace, and clean encoding artifacts.
 */
export function normalizeText(raw: string): string {
    return raw
        // Remove zero-width characters
        .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
        // Normalize unicode
        .normalize("NFC")
        // Replace multiple whitespace with single space
        .replace(/\s+/g, " ")
        // Remove leading/trailing whitespace per line
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        // Remove blank lines (more than 2 consecutive newlines)
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/**
 * Strip HTML tags and decode entities, returning plain text.
 */
export function sanitizeHtml(html: string): string {
    return html
        // Remove script/style blocks
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        // Remove HTML comments
        .replace(/<!--[\s\S]*?-->/g, "")
        // Replace br/p/div/li with newlines
        .replace(/<\s*(br|p|div|li|tr|h[1-6])[^>]*>/gi, "\n")
        // Remove remaining tags
        .replace(/<[^>]+>/g, " ")
        // Decode common HTML entities
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&aacute;/gi, "á")
        .replace(/&eacute;/gi, "é")
        .replace(/&iacute;/gi, "í")
        .replace(/&oacute;/gi, "ó")
        .replace(/&uacute;/gi, "ú")
        .replace(/&ntilde;/gi, "ñ")
        .replace(/&Ntilde;/gi, "Ñ")
        // Decode numeric entities
        .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_m, code) =>
            String.fromCharCode(parseInt(code, 16))
        );
}

/**
 * Full pipeline: strip HTML → normalize text.
 */
export function cleanAndNormalize(raw: string): string {
    return normalizeText(sanitizeHtml(raw));
}

/**
 * Split text into paragraphs (non-empty lines).
 */
export function splitParagraphs(text: string): string[] {
    return text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
}

/**
 * Split text into articles (Artículo N).
 * Returns array of { number, content } objects.
 */
export function splitArticles(
    text: string
): Array<{ number: string; content: string }> {
    const articleRegex =
        /(?:^|\n)\s*(Art[ií]culo\s+(\d+[A-Z]?(?:\s+(?:Bis|Ter|Qu[aá]ter|Quinquies))?))\s*[.\-–—:]?\s*/gi;

    const matches = [...text.matchAll(articleRegex)];
    if (matches.length === 0) return [];

    const articles: Array<{ number: string; content: string }> = [];

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const start = match.index! + match[0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
        const content = text.slice(start, end).trim();
        articles.push({ number: match[2], content });
    }

    return articles;
}
