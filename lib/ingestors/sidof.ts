import { ingestSidofByDate, ingestSidofWeek } from "@/lib/ingest/sidof";
import type { IngestorParams, IngestorResult } from "./types";

export async function ingest({ days = 1 }: IngestorParams = {}): Promise<IngestorResult> {
  const errors: string[] = [];
  let found = 0;
  let saved = 0;
  const sample: { title: string; url: string }[] = [];

  const safeDays = Math.max(1, Math.min(30, days));

  if (safeDays === 1) {
    const r = await ingestSidofByDate();
    found = r.found;
    saved = r.saved;
    if (r.error) errors.push(r.error);
    for (const s of r.sample) sample.push({ title: s.titulo, url: s.url });
  } else {
    const r = await ingestSidofWeek(safeDays);
    for (const res of r.results) {
      found += res.found;
      saved += res.saved;
      if (res.error) errors.push(res.error);
      for (const s of res.sample) {
        if (sample.length < 5) sample.push({ title: s.titulo, url: s.url });
      }
    }
  }

  return {
    source: "DOF/SIDOF",
    ok: errors.length === 0 || saved > 0,
    found,
    saved,
    errors,
    sample,
  };
}
