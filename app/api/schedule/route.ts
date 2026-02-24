import { NextResponse } from "next/server";
import { ingestQueue } from "@/lib/queue";

export async function POST() {
  await ingestQueue.add(
    "sidof-today",
    {},
    { repeat: { pattern: "0 7 * * *", tz: "America/Mexico_City" } }
  );

  await ingestQueue.add(
    "sidof-week",
    {},
    { repeat: { pattern: "10 7 * * 1", tz: "America/Mexico_City" } }
  );

  return NextResponse.json({ ok: true });
}
