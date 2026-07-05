import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/ingest → 308 permanent redirect to /api/ingest/sidof
 * Kept for backwards compatibility. Use /api/ingest/sidof directly.
 */
export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
  const dest = new URL("/api/ingest/sidof", req.nextUrl.origin);
  // Forward all query params (e.g. ?date=DD-MM-YYYY)
  req.nextUrl.searchParams.forEach((v, k) => dest.searchParams.set(k, v));
  return NextResponse.redirect(dest, { status: 308 });
}

