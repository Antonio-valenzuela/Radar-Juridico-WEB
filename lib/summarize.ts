/**
 * lib/summarize.ts
 * Genera un resumen extractivo simple (1-3 frases) limpiando HTML.
 */

export function cleanText(text: string): string {
    return text
        .replace(/<[^>]+>/g, " ") // Strip HTML tags
        .replace(/\s+/g, " ")     // Normalize whitespace
        .trim();
}

export function generateSummary(htmlOrText: string, maxLength = 300): string {
    const text = cleanText(htmlOrText);
    if (text.length <= maxLength) return text;

    // Try to take first 3 sentences
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let summary = "";

    for (const s of sentences) {
        if ((summary + s).length > maxLength) break;
        summary += s + " ";
    }

    // Fallback: hard cut
    if (summary.trim().length < 50) {
        return text.slice(0, maxLength) + "...";
    }

    return summary.trim();
}
