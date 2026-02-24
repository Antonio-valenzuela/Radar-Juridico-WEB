/**
 * lib/legalKeywords.ts
 * Detect legal keywords and classify change impact.
 */

// ─── Legal Keywords ───

const LEGAL_KEYWORDS = [
    "reforma",
    "reforman",
    "se reforman",
    "deroga",
    "se derogan",
    "derogación",
    "adiciona",
    "se adicionan",
    "adición",
    "modifica",
    "modifican",
    "modificación",
    "sustituye",
    "sustitución",
    "transitorio",
    "transitorios",
    "abroga",
    "abrogación",
    "expide",
    "se expide",
    "decreto",
] as const;

const HIGH_IMPACT_KEYWORDS = [
    "reforma constitucional",
    "nueva ley",
    "nuevo código",
    "se expide",
    "abrogación",
    "se abroga",
    "acción de inconstitucionalidad",
    "controversia constitucional",
    "reforma integral",
];

const MEDIUM_IMPACT_KEYWORDS = [
    "reforma",
    "reforman",
    "adiciona",
    "adicionan",
    "deroga",
    "derogan",
    "reglamento",
    "acuerdo general",
    "lineamientos",
    "modificación",
];

// ─── Detection ───

/**
 * Detect all legal keywords present in the given text.
 */
export function detectLegalKeywords(text: string): string[] {
    const lower = text.toLowerCase();
    return LEGAL_KEYWORDS.filter((kw) => lower.includes(kw));
}

/**
 * Classify the impact of a change based on keywords and diff statistics.
 */
export function classifyChangeImpact(
    text: string,
    stats: { addedCount: number; removedCount: number; modifiedCount: number }
): "alto" | "medio" | "bajo" {
    const lower = text.toLowerCase();

    // High impact: constitutional reform, new law, abrogation
    if (HIGH_IMPACT_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "alto";
    }

    // High impact: large number of changes
    if (stats.modifiedCount > 10 || stats.addedCount > 20 || stats.removedCount > 10) {
        return "alto";
    }

    // Medium impact: reform/addition/derogation keywords
    if (MEDIUM_IMPACT_KEYWORDS.some((kw) => lower.includes(kw))) {
        return "medio";
    }

    // Medium impact: moderate number of changes
    if (stats.modifiedCount > 3 || stats.addedCount > 5) {
        return "medio";
    }

    return "bajo";
}

/**
 * Determine the type of change from a diff result.
 */
export function classifyChangeType(
    oldContent: string | null,
    newContent: string | null,
    stats: { addedCount: number; removedCount: number; modifiedCount: number }
): "nuevo" | "reforma" | "eliminacion" | "modificacion_menor" {
    if (!oldContent && newContent) return "nuevo";
    if (oldContent && !newContent) return "eliminacion";

    const keywords = newContent ? detectLegalKeywords(newContent) : [];

    if (
        keywords.some((k) =>
            ["reforma", "reforman", "se reforman", "deroga", "adiciona", "modifica"].includes(k)
        )
    ) {
        return "reforma";
    }

    if (stats.modifiedCount > 3 || stats.addedCount > 5 || stats.removedCount > 3) {
        return "reforma";
    }

    return "modificacion_menor";
}
