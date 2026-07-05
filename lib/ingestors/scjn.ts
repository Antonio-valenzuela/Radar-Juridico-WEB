import { prisma } from "@/lib/prisma";
import { ingestScjnComunicados } from "@/lib/ingest/scjn";
import type { IngestorParams, IngestorResult } from "./types";

// SCJN comunicado IDs are sequential. ~8600 ≈ 2025.
// New comunicados are published ~2-5 per day.
const SCJN_FALLBACK_ID = 8600;
const IDS_PER_DAY = 5;

async function getLatestScjnId(): Promise<number> {
  const last = await prisma.item.findFirst({
    where: { source: "scjn" },
    orderBy: { createdAt: "desc" },
  });
  if (last) {
    const m = last.url.match(/id=(\d+)/i);
    if (m) {
      const lastId = parseInt(m[1]);
      return lastId + IDS_PER_DAY; // buffer forward
    }
  }
  return SCJN_FALLBACK_ID;
}

/**
 * Ingest SCJN comunicados for the last `days` days.
 * Uses ID-based iteration (SCJN has no date-range API).
 */
export async function ingest({ days = 7 }: IngestorParams = {}): Promise<IngestorResult> {
  const startId = await getLatestScjnId();
  const count = Math.max(30, Math.min(150, days * IDS_PER_DAY));

  const r = await ingestScjnComunicados(startId, count);

  return {
    source: "scjn",
    ok: r.ok,
    found: r.checked,
    saved: r.saved,
    errors: [],
    sample: r.sample.map((s) => ({ title: s.title, url: s.url })),
  };
}
