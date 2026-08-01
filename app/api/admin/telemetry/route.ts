import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { collectTelemetry } from "@/worker/telemetry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // requireAdmin valida el encabezado x-admin-token con la política central.
  const adminCheck = requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const telemetry = await collectTelemetry();
    return NextResponse.json(telemetry, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/admin/telemetry] GET error", {
      kind: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        databaseAvailable: false,
        error: "database_unavailable",
        message: "La base de datos no está disponible temporalmente.",
      },
      { status: 503 },
    );
  }
}
