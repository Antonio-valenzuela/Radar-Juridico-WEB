/**
 * GET /api/probe?url=...
 * Test URL reachability with 10s timeout.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const u = searchParams.get("url");
  if (!u) {
    return NextResponse.json(
      { ok: false, error: "Missing ?url= parameter" },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const start = Date.now();
    const res = await fetch(u, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) juridico-radar/1.0",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
      },
    });

    clearTimeout(timeout);
    const elapsed = Date.now() - start;

    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    const isJson = contentType.includes("json");

    return NextResponse.json({
      ok: true,
      url: u,
      status: res.status,
      finalUrl: res.url,
      contentType,
      isJson,
      elapsedMs: elapsed,
      sample: text.slice(0, 500),
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    clearTimeout(timeout);
    const isTimeout = e?.name === "AbortError";
    return NextResponse.json(
      {
        ok: false,
        url: u,
        error: isTimeout ? "Timeout (10s)" : String(e?.message || e),
        timestamp: new Date().toISOString(),
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}