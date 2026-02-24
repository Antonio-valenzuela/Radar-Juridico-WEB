/**
 * lib/changeDetection.ts
 * SHA256 hashing, paragraph-level diff, article-level diff.
 */

import { createHash } from "crypto";
import * as Diff from "diff";
import {
    normalizeText,
    splitParagraphs,
    splitArticles,
} from "./textNormalizer";

// ─── Types ───

export interface ParagraphDiff {
    type: "added" | "removed" | "unchanged";
    text: string;
}

export interface ArticleDiff {
    articleNumber: string;
    type: "added" | "removed" | "modified" | "unchanged";
    oldContent?: string;
    newContent?: string;
}

export interface DiffResult {
    hasChanges: boolean;
    paragraphDiffs: ParagraphDiff[];
    articleDiffs: ArticleDiff[];
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    summary: string;
}

// ─── Hash ───

/**
 * Compute SHA256 hash of normalized text.
 */
export function computeHash(text: string): string {
    const normalized = normalizeText(text);
    return createHash("sha256").update(normalized, "utf8").digest("hex");
}

// ─── Paragraph Diff ───

/**
 * Compare two texts paragraph by paragraph.
 */
export function diffByParagraphs(
    oldText: string,
    newText: string
): ParagraphDiff[] {
    const oldNorm = normalizeText(oldText);
    const newNorm = normalizeText(newText);

    const changes = Diff.diffLines(oldNorm, newNorm);
    const result: ParagraphDiff[] = [];

    for (const part of changes) {
        const paragraphs = splitParagraphs(part.value);
        for (const p of paragraphs) {
            if (part.added) {
                result.push({ type: "added", text: p });
            } else if (part.removed) {
                result.push({ type: "removed", text: p });
            } else {
                result.push({ type: "unchanged", text: p });
            }
        }
    }

    return result;
}

// ─── Article Diff ───

/**
 * Compare two legal texts at the article level.
 */
export function diffByArticles(
    oldText: string,
    newText: string
): ArticleDiff[] {
    const oldArticles = splitArticles(normalizeText(oldText));
    const newArticles = splitArticles(normalizeText(newText));

    // If neither text has articles, return empty
    if (oldArticles.length === 0 && newArticles.length === 0) return [];

    const oldMap = new Map(oldArticles.map((a) => [a.number, a.content]));
    const newMap = new Map(newArticles.map((a) => [a.number, a.content]));

    const allNumbers = new Set([...oldMap.keys(), ...newMap.keys()]);
    const result: ArticleDiff[] = [];

    for (const num of allNumbers) {
        const oldContent = oldMap.get(num);
        const newContent = newMap.get(num);

        if (oldContent && !newContent) {
            result.push({ articleNumber: num, type: "removed", oldContent });
        } else if (!oldContent && newContent) {
            result.push({ articleNumber: num, type: "added", newContent });
        } else if (oldContent && newContent) {
            if (normalizeText(oldContent) !== normalizeText(newContent)) {
                result.push({
                    articleNumber: num,
                    type: "modified",
                    oldContent,
                    newContent,
                });
            } else {
                result.push({ articleNumber: num, type: "unchanged" });
            }
        }
    }

    return result;
}

// ─── Full Diff ───

/**
 * Generate a full diff result with summary.
 */
export function generateDiff(oldText: string, newText: string): DiffResult {
    const paragraphDiffs = diffByParagraphs(oldText, newText);
    const articleDiffs = diffByArticles(oldText, newText);

    const addedCount =
        paragraphDiffs.filter((d) => d.type === "added").length +
        articleDiffs.filter((d) => d.type === "added").length;
    const removedCount =
        paragraphDiffs.filter((d) => d.type === "removed").length +
        articleDiffs.filter((d) => d.type === "removed").length;
    const modifiedCount = articleDiffs.filter(
        (d) => d.type === "modified"
    ).length;

    const hasChanges = addedCount > 0 || removedCount > 0 || modifiedCount > 0;

    const parts: string[] = [];
    if (addedCount > 0) parts.push(`${addedCount} agregado(s)`);
    if (removedCount > 0) parts.push(`${removedCount} eliminado(s)`);
    if (modifiedCount > 0) parts.push(`${modifiedCount} modificado(s)`);

    const summary = hasChanges ? parts.join(", ") : "Sin cambios";

    return {
        hasChanges,
        paragraphDiffs,
        articleDiffs,
        addedCount,
        removedCount,
        modifiedCount,
        summary,
    };
}

/**
 * Generate HTML-safe highlighted diff for display.
 */
export function generateHighlightedDiff(
    oldText: string,
    newText: string
): string {
    const changes = Diff.diffWords(normalizeText(oldText), normalizeText(newText));
    let html = "";

    for (const part of changes) {
        const escaped = part.value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        if (part.added) {
            html += `<ins style="background:#d4edda;text-decoration:none;">${escaped}</ins>`;
        } else if (part.removed) {
            html += `<del style="background:#f8d7da;text-decoration:line-through;">${escaped}</del>`;
        } else {
            html += escaped;
        }
    }

    return html;
}
