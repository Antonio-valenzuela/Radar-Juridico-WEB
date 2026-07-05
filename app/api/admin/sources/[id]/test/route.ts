import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { prisma } from "@/lib/prisma";
import { checkSourceHealth } from "@/lib/sources/sourceHealth";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  let id = "";
  try {
    const params = await props.params;
    id = params?.id || "";
  } catch {
    // Fallback parsing from URL path
  }

  if (!id) {
    const parts = req.nextUrl.pathname.split("/");
    // El id está justo antes del último segmento 'test' (ej: /api/admin/sources/ID/test)
    id = parts[parts.length - 2] || "";
  }

  const adminCheck = requireAdmin(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }


  try {
    const source = await prisma.officialSource.findUnique({
      where: { id },
    });

    if (!source) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: "Fuente oficial no encontrada." },
        { status: 404 }
      );
    }

    if (source.crawlMode === 'manual_url') {
      return NextResponse.json(
        { 
          ok: false, 
          errorCode: "MANUAL_URL_NOT_TESTABLE", 
          message: "Las fuentes manual_url no soportan prueba automática de conexión. Usa 'Ejecutar Ingesta Manual' con una URL específica." 
        },
        { status: 400 }
      );
    }

    const result = await checkSourceHealth(source);
    const reachableStatuses = new Set([
      "OK",
      "BLOCKED_BY_PROVIDER",
      "BROWSER_REQUIRED",
      "WARNING_ACCESSIBLE_WITH_LIMITATIONS",
    ]);
    const reachable = reachableStatuses.has(result.status);

    // Actualizar timestamps en base de datos
    await prisma.officialSource.update({
      where: { id: source.id },
      data: {
        lastCheckedAt: new Date(),
        lastSuccessAt: reachable ? new Date() : undefined,
        lastFailureAt: !reachable ? new Date() : undefined,
        lastErrorCategory: result.status === "OK" ? null : result.status,
      }
    });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error(`[api/admin/sources/${id}/test] POST error:`, error);
    return NextResponse.json(
      { ok: false, error: "server_error", message: error.message || "Error al probar la conexión de la fuente." },
      { status: 500 }
    );
  }
}
