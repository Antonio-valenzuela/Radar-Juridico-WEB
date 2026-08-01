import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { enrichItem } from "@/lib/enrichment/enrichItem";

export async function POST(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await req.json().catch(() => null);
    const itemId = body && typeof body === 'object' && typeof body.itemId === 'string' ? body.itemId.trim() : '';

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json(
        { ok: false, error: "invalid_item", message: "Falta un identificador de documento válido." },
        { status: 400 }
      );
    }

    const result = await enrichItem(itemId);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "enrichment_failed", message: "No fue posible generar el análisis IA." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      itemId: result.itemId,
      enrichment: result.enrichment,
    });
  } catch (error) {
    console.error("API /api/admin/enrich-item error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { ok: false, error: "enrichment_failed", message: "No fue posible generar el análisis IA." },
      { status: 500 }
    );
  }
}

