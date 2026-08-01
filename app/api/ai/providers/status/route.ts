import { NextRequest, NextResponse } from "next/server";
import { getProvidersStatus } from "@/lib/ai/orchestrator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const statuses = await getProvidersStatus();
    return NextResponse.json({
      ok: true,
      providers: statuses,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Error al obtener estado de proveedores." },
      { status: 500 }
    );
  }
}
