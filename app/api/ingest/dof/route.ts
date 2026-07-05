import { NextResponse } from "next/server";
import { ingestDofWeb } from "@/lib/ingest/dofWeb";
import { requireAdmin } from "@/lib/security/adminAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/ingest/dof?date=DD/MM/YYYY
 * Ingesta DOF desde web dof.gob.mx (scrape).
 */
export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return auth.response;
    try {
        const url = new URL(req.url);
        const date = url.searchParams.get("date") || undefined; // DD/MM/YYYY

        const result = await ingestDofWeb(date);

        return NextResponse.json(result);
    } catch (err: any) {
        console.error("ingest dof web error", err);
        return NextResponse.json(
            { ok: false, error: "Fallo en ingesta DOF WEB" },
            { status: 500 }
        );
    }
}

