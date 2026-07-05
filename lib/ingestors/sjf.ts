import { prisma } from "@/lib/prisma";
import { ingestSjf } from "@/lib/ingest/sjf";
import type { IngestorParams, IngestorResult } from "./types";

// SJF2 IDs are sequential. ~2029500 ≈ early 2025.
// New tesis are published ~40-80 per day. Conservative estimate: 50/day.
const SJF_FALLBACK_ID = 2029500;
const IDS_PER_DAY = 50;

async function getLatestSjfId(): Promise<number> {
  const last = await prisma.item.findFirst({
    where: { source: "sjf" },
    orderBy: { createdAt: "desc" },
  });
  if (last) {
    const m = last.url.match(/\/tesis\/(\d+)$/);
    if (m) {
      const lastId = parseInt(m[1]);
      // Add buffer to catch any newer IDs since last run
      return lastId + IDS_PER_DAY;
    }
  }
  return SJF_FALLBACK_ID;
}

/**
 * Ingest SJF tesis/jurisprudencia for the last `days` days.
 * Uses ID-based iteration (SJF2 has no date-range search API).
 */
export async function ingest({ days = 7 }: IngestorParams = {}): Promise<IngestorResult> {
  const startId = await getLatestSjfId();
  const count = Math.max(20, Math.min(200, days * IDS_PER_DAY));

  const r = await ingestSjf(startId, count);

  return {
    source: "sjf",
    ok: r.ok,
    found: r.checked,
    saved: r.saved,
    errors: r.failed > 0 ? [`${r.failed} of ${r.checked} IDs failed or had no content`] : [],
    sample: r.sample.map((s) => ({ title: s.rubro, url: s.url })),
  };
}
