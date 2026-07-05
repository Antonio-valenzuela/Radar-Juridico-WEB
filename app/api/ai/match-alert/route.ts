import { NextRequest, NextResponse } from "next/server";
import { matchAlertRule } from "../../../../lib/ai/router";
import { sanitizeLegalAiAnalysis } from "../../../../lib/ai/types";
import { requireAdmin } from "../../../../lib/security/adminAuth";
import { checkRateLimit, extractIp } from "../../../../lib/security/rateLimit";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (typeof input.ruleText !== "string" || !input.ruleText.trim()) {
    return NextResponse.json({ ok: false, error: "ruleText_required" }, { status: 400 });
  }

  if (typeof input.documentTitle !== "string" || !input.documentTitle.trim()) {
    return NextResponse.json({ ok: false, error: "documentTitle_required" }, { status: 400 });
  }

  const aiAnalysis =
    input.aiAnalysis && typeof input.aiAnalysis === "object"
      ? sanitizeLegalAiAnalysis(input.aiAnalysis, {
          title: input.documentTitle.trim(),
          summary: typeof input.documentSummary === "string" ? input.documentSummary : null,
        })
      : undefined;

  const match = await matchAlertRule({
    ruleText: input.ruleText.trim(),
    matter: typeof input.matter === "string" ? input.matter : null,
    keywords: asStringArray(input.keywords),
    entities: asStringArray(input.entities),
    affectedSectors: asStringArray(input.affectedSectors),
    documentTitle: input.documentTitle.trim(),
    documentSummary: typeof input.documentSummary === "string" ? input.documentSummary : null,
    aiAnalysis,
  });

  return NextResponse.json({ ok: true, match });
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
