/**
 * Unified ingestion dispatcher.
 * Orchestrates parsing from all sources, records IngestRun.
 */
import { prisma } from "@/lib/prisma";
import { ingestSidofByDate, ingestSidofWeek } from "@/lib/ingest/sidof";
import { ingestDofWeb } from "@/lib/ingest/dofWeb";
import { ingestScjnComunicados } from "@/lib/ingest/scjn";

export type IngestOptions = {
    source?: "SIDOF" | "DOF" | "SCJN" | "ALL";
    date?: string; // DD-MM-YYYY for SIDOF, DD/MM/YYYY for DOF
    days?: number; // multi-day for SIDOF
    scjnStartId?: number;
    scjnCount?: number;
};

export type IngestRunResult = {
    id: string;
    source: string;
    status: string;
    scanned: number;
    inserted: number;
    errorsCount: number;
    lastError: string | null;
    durationMs: number;
    details: Record<string, any>;
};

export async function runIngestion(
    opts: IngestOptions = {}
): Promise<IngestRunResult> {
    const source = opts.source || "ALL";
    const startTime = Date.now();

    const run = await prisma.ingestRun.create({
        data: { source, status: "running" },
    });

    let totalScanned = 0;
    let totalInserted = 0;
    let totalErrors = 0;
    let lastError: string | null = null;
    const details: Record<string, any> = {};

    const sources =
        source === "ALL" ? ["SIDOF", "DOF", "SCJN"] : [source];

    for (const src of sources) {
        try {
            switch (src) {
                case "SIDOF": {
                    if (opts.days && opts.days > 1) {
                        const result = await ingestSidofWeek(opts.days);
                        const totals = result.results.reduce(
                            (acc, r) => ({
                                found: acc.found + r.found,
                                saved: acc.saved + r.saved,
                            }),
                            { found: 0, saved: 0 }
                        );
                        totalScanned += totals.found;
                        totalInserted += totals.saved;
                        details.SIDOF = {
                            ok: result.ok,
                            days: result.days,
                            found: totals.found,
                            saved: totals.saved,
                        };
                    } else {
                        const result = await ingestSidofByDate(opts.date);
                        totalScanned += result.found;
                        totalInserted += result.saved;
                        details.SIDOF = result;
                        if (!result.ok && result.error) {
                            totalErrors++;
                            lastError = `SIDOF: ${result.error}`;
                        }
                    }
                    break;
                }
                case "DOF": {
                    const result = await ingestDofWeb(opts.date);
                    totalScanned += result.found;
                    totalInserted += result.saved;
                    details.DOF = result;
                    if (!result.ok) {
                        totalErrors++;
                        lastError = "DOF: fetch failed";
                    }
                    break;
                }
                case "SCJN": {
                    const startId = opts.scjnStartId || 8300;
                    const count = opts.scjnCount || 20;
                    const result = await ingestScjnComunicados(startId, count);
                    totalScanned += result.checked;
                    totalInserted += result.saved;
                    details.SCJN = result;
                    break;
                }
            }
        } catch (e: any) {
            totalErrors++;
            lastError = `${src}: ${e?.message || String(e)}`;
            details[src] = { ok: false, error: lastError };
        }
    }

    const durationMs = Date.now() - startTime;

    await prisma.ingestRun.update({
        where: { id: run.id },
        data: {
            status: totalErrors > 0 ? "completed_with_errors" : "completed",
            finishedAt: new Date(),
            scanned: totalScanned,
            inserted: totalInserted,
            errorsCount: totalErrors,
            lastError,
        },
    });

    return {
        id: run.id,
        source,
        status: totalErrors > 0 ? "completed_with_errors" : "completed",
        scanned: totalScanned,
        inserted: totalInserted,
        errorsCount: totalErrors,
        lastError,
        durationMs,
        details,
    };
}
