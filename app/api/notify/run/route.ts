import { NextRequest, NextResponse } from "next/server";
import { runNotifications } from "@/lib/notifications/run";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json().catch(() => ({}));
    const result = await runNotifications({
      email: body?.email,
      orgSlug: body?.orgSlug,
      days: Number(body?.days || 1),
      channels: body?.channels,
      dryRun: Boolean(body?.dryRun),
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

