import { ingestDofWeb } from "@/lib/ingest/dofWeb";
import type { IngestorParams, IngestorResult } from "./types";

export async function ingest({ days = 1 }: IngestorParams = {}): Promise<IngestorResult> {
  const errors: string[] = [];
  let found = 0;
  let saved = 0;
  const sample: { title: string; url: string }[] = [];

  const safeDays = Math.max(1, Math.min(30, days));
  const today = new Date();

  for (let i = 0; i < safeDays; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dd = d.getDate().toString().padStart(2, "0");
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const yyyy = d.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;

    try {
      const r = await ingestDofWeb(dateStr);
      found += r.found;
      saved += r.saved;
      for (const s of r.sample) {
        if (sample.length < 5) sample.push({ title: s.title, url: s.url });
      }
    } catch (e: any) {
      errors.push(`dof-web ${dateStr}: ${e.message}`);
    }
  }

  return {
    source: "dof-web",
    ok: errors.length < safeDays,
    found,
    saved,
    errors,
    sample,
  };
}
