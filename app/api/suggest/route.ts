import { NextResponse } from "next/server";
import { SEARCH_LEXICON } from "@/lib/search/lexicon";

export const dynamic = "force-dynamic";

/**
 * API Route: /api/suggest
 * Devuelve sugerencias basadas en el lexicón legal.
 */
export async function GET(req: Request) {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").toLowerCase().trim();

    if (!q || q.length < 2) {
        return NextResponse.json({ ok: true, suggestions: [] });
    }

    const suggestions = new Set<string>();

    // 1. Claves del lexicón
    for (const key of Object.keys(SEARCH_LEXICON)) {
        if (key.startsWith(q)) {
            suggestions.add(key);
        }
    }

    // 2. Sinónimos
    for (const synonyms of Object.values(SEARCH_LEXICON)) {
        for (const s of synonyms) {
            if (s.toLowerCase().includes(q)) {
                suggestions.add(s);
            }
        }
    }

    return NextResponse.json({
        ok: true,
        suggestions: Array.from(suggestions).slice(0, 10)
    });
}
