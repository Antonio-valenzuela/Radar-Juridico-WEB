import { NextRequest, NextResponse } from "next/server";
import { analyzeLegalDocumentWithProvider } from "../../../../lib/ai/provider";
import { requireAdmin } from "../../../../lib/security/adminAuth";
import { checkRateLimit, extractIp } from "../../../../lib/security/rateLimit";

export async function POST(request: NextRequest) {
  const adminCheck = requireAdmin(request);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const ip = extractIp(request);
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.ok) {
    return NextResponse.json({ ok: false, error: "too many requests" }, { status: 429, headers: rateLimit.headers });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_json",
      },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_body",
      },
      { status: 400 }
    );
  }

  const input = body as Record<string, unknown>;

  if (typeof input.title !== "string" || !input.title.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: "title_required",
      },
      { status: 400 }
    );
  }

  const result = await analyzeLegalDocumentWithProvider({
    title: input.title.trim(),
    summary: typeof input.summary === "string" ? input.summary : null,
    text: typeof input.text === "string" ? input.text : null,
    sourceUrl: typeof input.sourceUrl === "string" ? input.sourceUrl : null,
  });

  return NextResponse.json({
    ok: true,
    provider: result.provider,
    analysis: result.analysis,
  });
}
